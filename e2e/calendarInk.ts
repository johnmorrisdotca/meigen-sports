// Measures a calendar icon by drawing it in the browser: the ink of one part (the day or the year) and the colour at points.
import type { Page } from "@playwright/test";

/** The ink of a part, in drawing units (the icon's own viewBox), or null when nothing of it is drawn. */
export interface Ink {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Look {
  /** The viewBox of the icon. */
  view: { x: number; y: number; w: number; h: number };
  /** The ink of each named part: `day`, `year`, and `all` for everything drawn. */
  ink: Record<string, Ink | null>;
  /** The colour (r,g,b,a) at each asked point, in drawing units. */
  colours: number[][];
}

/** Draw `svg` at its own size, scaled by `scale`, and read back the ink of the parts and the colours at the points. */
export async function look(page: Page, svg: string, parts: readonly string[], points: ReadonlyArray<readonly [number, number]> = [], scale = 2): Promise<Look> {
  return page.evaluate(
    async ({ svg, parts, points, scale }) => {
      const view = /viewBox="([-\d. ]+)"/.exec(svg)![1]!.split(" ").map(Number) as [number, number, number, number];
      const width = Number(/ width="([\d.]+)"/.exec(svg)![1]);
      const px = (width * scale) / view[2];
      const w = Math.round(view[2] * px);
      const h = Math.round(view[3] * px);
      const read = async (doc: string) => {
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const boxOf = (data: Uint8ClampedArray) => {
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            if (data[(y * w + x) * 4 + 3]! > 40) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        return x1 < 0 ? null : { x0: view[0] + x0 / px, y0: view[1] + y0 / px, x1: view[0] + (x1 + 1) / px, y1: view[1] + (y1 + 1) / px };
      };
      const ink: Record<string, { x0: number; y0: number; x1: number; y1: number } | null> = {};
      const everything = await read(svg);
      ink.all = boxOf(everything);
      for (const part of parts) {
        const only = svg.replace(/^(<svg[^>]*>)/, `$1<style>*{visibility:hidden}[data-part="${part}"],[data-part="${part}"] *{visibility:visible}</style>`);
        ink[part] = boxOf(await read(only));
      }
      const colours = points.map(([x, y]) => {
        const at = (Math.min(h - 1, Math.max(0, Math.round((y - view[1]) * px))) * w + Math.min(w - 1, Math.max(0, Math.round((x - view[0]) * px)))) * 4;
        return [everything[at]!, everything[at + 1]!, everything[at + 2]!, everything[at + 3]!];
      });
      return { view: { x: view[0], y: view[1], w: view[2], h: view[3] }, ink, colours };
    },
    { svg, parts: [...parts], points: points.map((p) => [...p]), scale },
  ) as Promise<Look>;
}
