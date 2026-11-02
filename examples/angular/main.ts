import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { TodayCardComponent } from "./today-card.component";

void bootstrapApplication(TodayCardComponent, { providers: [provideZonelessChangeDetection()] });
