import { mount } from "svelte";
import App from "./App.svelte";
import "click-to-source/init";

const app = mount(App, {
  target: document.getElementById("app"),
});

export default app;