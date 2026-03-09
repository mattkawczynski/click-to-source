import { bootstrapApplication } from "@angular/platform-browser";
import "click-to-source/init";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent).catch((error) => console.error(error));