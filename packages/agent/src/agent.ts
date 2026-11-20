import { start } from './core.js'

// Script-tag entry: <script src="/agent/perfagent.js" data-endpoint="…" data-sample="0.1" data-route="/checkout"></script>
const script = document.currentScript as HTMLScriptElement | null
const data = script?.dataset ?? {}
start({ endpoint: data.endpoint, sample: data.sample ? Number(data.sample) : undefined, route: data.route })
