import "urlpattern-polyfill"
import "mdui/mdui.css"
import "mdui"
import { setColorScheme } from "mdui/functions/setColorScheme.js"
import { startOfflineSupport } from "./api.ts"
import "./styles.css"
import "./quote-app.ts"

setColorScheme("#006b5f")
startOfflineSupport()

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js")
}
