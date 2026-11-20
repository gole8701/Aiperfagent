import { resultFromDetected } from '../detected-report.js'
import { detectMetricsInText } from '../text-metrics.js'
import type { Importer } from '../types.js'

/** Pasted text: any copied table or report wording. Must be registered last. */
export const textImporter: Importer = {
  format: 'text',
  matches: (input, json) =>
    json === undefined &&
    typeof input.text === 'string' &&
    detectMetricsInText(input.text, 'pasted text').length > 0,
  run: (input) => {
    const text = input.text ?? ''
    return Promise.resolve(
      resultFromDetected(
        'text',
        detectMetricsInText(text, input.filename ?? 'pasted text'),
        input,
        text,
      ),
    )
  },
}
