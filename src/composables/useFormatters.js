export function useFormatters() {
  function formatMoney(value) {
    if (value == null) return 'R$ —'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''))
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function formatPct(value) {
    if (value == null) return '0%'
    return (value * 100).toFixed(0) + '%'
  }

  return { formatMoney, formatDate, formatDateTime, formatPct }
}
