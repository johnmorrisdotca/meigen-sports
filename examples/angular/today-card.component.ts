import { Component, Input, OnInit, inject } from "@angular/core";
import { DomSanitizer, type SafeHtml } from "@angular/platform-browser";
import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

@Component({
  selector: "app-today-card",
  standalone: true,
  template: `<div [innerHTML]="html"></div>`,
})
export class TodayCardComponent implements OnInit {
  @Input() now = "2026-10-20T15:00:00Z";
  @Input() timeZone = "America/Toronto";
  html: SafeHtml = "";
  private readonly sanitizer = inject(DomSanitizer);

  ngOnInit(): void {
    const [month, day] = calendarDayInZone(this.timeZone, this.now).split("-").map(Number);
    const facts = renderRun(today(offline, this.timeZone, this.now).slice(0, 3), { seed: "card", locale: "en", asOf: this.now.slice(0, 10) });
    // displayMarkup escapes every fact's text, so its string is safe to trust as HTML (Angular's own sanitiser would strip the calendar's SVG).
    this.html = this.sanitizer.bypassSecurityTrustHtml(displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) }));
  }
}
