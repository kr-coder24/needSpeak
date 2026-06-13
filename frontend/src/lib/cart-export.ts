export interface ExportableCart {
  context_summary: string
  intent_type: string
  cart: any[]
  total_price_inr: number
}

export function exportAsWhatsApp(data: ExportableCart): string {
  const lines = data.cart.map(
    (item) => `• ${item.name} (${item.brand}) × ${item.quantity_units} ${item.unit} — ₹${(item.price_per_unit_inr * item.quantity_units).toFixed(0)}`
  )
  return [
    `🛒 *${data.context_summary || data.intent_type}*`,
    ``,
    ...lines,
    ``,
    `*Total: ₹${data.total_price_inr.toFixed(0)}*`,
    ``,
    `Built with NeedSpeak 🚀`,
  ].join("\n")
}

export function exportAsCSV(data: ExportableCart): string {
  const header = "Name,Brand,Qty,Unit,Price Per Unit,Line Total"
  const rows = data.cart.map((item) =>
    [
      item.name,
      item.brand,
      item.quantity_units,
      item.unit,
      item.price_per_unit_inr,
      (item.price_per_unit_inr * item.quantity_units).toFixed(0),
    ].join(",")
  )
  return [header, ...rows].join("\n")
}

export function downloadCSV(data: ExportableCart, filename = "cart.csv") {
  const csv = exportAsCSV(data)
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyWhatsAppToClipboard(data: ExportableCart): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(exportAsWhatsApp(data))
    return true
  } catch {
    return false
  }
}
