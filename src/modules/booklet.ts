/**
 * O carnê (`paymentBook`). (Track E)
 *
 * `GET /v3/installments/{id}/paymentBook` e `GET /v3/subscriptions/{id}/paymentBook`
 * NÃO devolvem JSON: devolvem **um PDF** (`application/pdf`), e é por isso que a
 * spec declara a resposta 200 sem schema. Um cliente que espera bytes de PDF e
 * recebe `{"url": "..."}` quebra — então geramos um PDF de verdade, mínimo mas
 * válido: cabeçalho, xref com offsets corretos e trailer.
 *
 * O conteúdo é fictício (não há banco emissor aqui), mas o TIPO da resposta é o
 * real. É a diferença entre um simulador e um mock de resposta estática.
 */

/**
 * PDF só com ASCII: os offsets do xref são contados em BYTES, e um acento
 * (2 bytes em UTF-8) desalinharia a tabela em silêncio — o arquivo abriria em
 * alguns leitores e não em outros. Dobramos para ASCII antes de escrever.
 */
function toAscii(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira os diacriticos
    .replace(/[^\x20-\x7e]/g, '?')
}

/** Escapa os caracteres que têm significado dentro de uma string literal do PDF. */
function escapePdf(s: string): string {
  return toAscii(s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function buildPaymentBookPdf(title: string, lines: readonly string[]): string {
  const content = [
    'BT',
    '/F1 14 Tf',
    '40 800 Td',
    `(${escapePdf(title)}) Tj`,
    '/F1 10 Tf',
    ...lines.flatMap((line) => ['0 -18 Td', `(${escapePdf(line)}) Tj`]),
    'ET',
  ].join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefStart}\n%%EOF\n`

  // ASCII puro por construção: 1 caractere = 1 byte, e os offsets do xref fecham.
  return pdf
}

/** A resposta HTTP do carnê. Content-Type real: o cliente recebe um PDF. */
export function paymentBookResponse(title: string, lines: readonly string[]): Response {
  return new Response(buildPaymentBookPdf(title, lines), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'inline; filename="carne.pdf"',
    },
  })
}

/**
 * A ordenação do carnê. `sort`/`order` existem na spec das duas operações; a doc
 * não diz quais campos são aceitos, então suportamos os que fazem sentido num
 * carnê (vencimento e valor) e caímos em `dueDate` para qualquer outro.
 * TODO(regra): confirmar o conjunto de campos aceitos pelo Asaas real.
 */
export function bookletOrder(query: Record<string, unknown>): {
  field: 'dueDate' | 'value'
  desc: boolean
} {
  const raw = String(query.sort ?? 'dueDate')
  return {
    field: raw === 'value' ? 'value' : 'dueDate',
    desc: String(query.order ?? 'asc').toLowerCase() === 'desc',
  }
}
