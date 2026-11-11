import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Atelie, Pedido, Cliente, Medidas } from '../types';
import { formatarMoeda, getAtelieCountry, PAISES_CONFIG } from './localization';

interface RelatorioStats {
  filtered: Pedido[];
  faturamento: number;
  recebido: number;
  aReceber: number;
  devList: { cliente: Cliente; totalOwed: number; pedidos: Pedido[] }[];
  leaders: { clienteNome: string; telefone: string; totalGasto: number; totalPedidos: number }[];
  pecasS: { key: string; label: string; count: number; percentage: number }[];
  statusS: { key: string; label: string; count: number; percentage: number }[];
  taxa: number;
}

const statusLabels: Record<string, string> = {
  em_andamento: 'Em Manufatura',
  aguardando_prova: 'Aguardando Prova',
  finalizado: 'Pronto / Finalizado',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
};

const pecaLabels: Record<string, string> = {
  vestido: 'Vestido',
  calca: 'Calça',
  saia: 'Saia',
  camisa: 'Camisa',
  blazer: 'Blazer',
  ajuste: 'Bainha / Ajuste',
  outro: 'Outro Modelo'
};

/**
 * Exporta Relatório Financeiro e Operacional Completo em PDF
 */
export function exportarRelatorioPDF(
  atelie: Atelie,
  stats: RelatorioStats,
  periodoLabel: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const country = PAISES_CONFIG[getAtelieCountry(atelie)];

  // Helper para desenhar cabeçalho corporativo
  const drawHeader = () => {
    // Barra superior decorativa
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 26, 'F');

    // Linha dourada sutil de ateliê
    doc.setFillColor(217, 119, 6); // amber-600
    doc.rect(0, 26, pageWidth, 2, 'F');

    // Título do Ateliê
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(atelie.nome.toUpperCase(), 14, 12);

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`RELATÓRIO FINANCEIRO & OPERACIONAL • SISTEMA FLOWTAILOR`, 14, 19);

    // Data e hora de geração no canto direito
    const dataHoraStr = `${new Date().toLocaleDateString('pt-AO')} às ${new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}`;
    doc.setFontSize(8);
    doc.text(`Gerado em: ${dataHoraStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Período: ${periodoLabel}`, pageWidth - 14, 19, { align: 'right' });
  };

  // Helper para desenhar rodapé elegante
  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `FlowTailor • ${atelie.nome} • Contacto: +${atelie.telefone} • Licença: ${atelie.plano === 'pro' ? 'PROFISSIONAL PRO' : 'BÁSICO'}`,
      14,
      pageHeight - 7
    );
    doc.text(
      `Página ${pageNum} de ${totalPages}`,
      pageWidth - 14,
      pageHeight - 7,
      { align: 'right' }
    );
  };

  // Renderizar Cabeçalho
  drawHeader();

  // 1. CARDS DE RESUMO FINANCEIRO (Kpis)
  const startY = 36;
  const cardWidth = (pageWidth - 28 - 9) / 4; // 4 cards com espaçamento de 3mm
  const cardHeight = 22;

  const cardsData = [
    {
      title: 'FATURAMENTO',
      value: formatarMoeda(stats.faturamento, atelie),
      sub: `${stats.filtered.length} encomendas`,
      bg: [248, 250, 252],
      border: [203, 213, 225],
      valColor: [15, 23, 42]
    },
    {
      title: 'TOTAL RECEBIDO',
      value: formatarMoeda(stats.recebido, atelie),
      sub: `${stats.taxa.toFixed(1)}% recolhido`,
      bg: [240, 253, 244],
      border: [187, 247, 208],
      valColor: [22, 101, 52]
    },
    {
      title: 'SALDO A RECEBER',
      value: formatarMoeda(stats.aReceber, atelie),
      sub: `${stats.devList.length} clientes c/ pendência`,
      bg: [254, 242, 242],
      border: [254, 202, 202],
      valColor: [185, 28, 28]
    },
    {
      title: 'TICKET MÉDIO',
      value: stats.filtered.length > 0 ? formatarMoeda(Math.round(stats.faturamento / stats.filtered.length), atelie) : formatarMoeda(0, atelie),
      sub: `Média por encomenda`,
      bg: [238, 242, 255],
      border: [199, 210, 254],
      valColor: [55, 48, 163]
    }
  ];

  cardsData.forEach((c, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(c.title, x + 3.5, startY + 6);

    doc.setFontSize(9.5);
    doc.setTextColor(c.valColor[0], c.valColor[1], c.valColor[2]);
    doc.text(c.value, x + 3.5, startY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(c.sub, x + 3.5, startY + 18);
  });

  // 2. TABELA DE ENCOMENDAS FILTRADAS
  const tableData = stats.filtered.map(p => {
    const pendente = Math.max(0, p.valor - p.sinalPago);
    const dataCriacao = new Date(p.criadoEm).toLocaleDateString('pt-AO');
    const dataEntrega = p.prazoEntrega ? new Date(p.prazoEntrega).toLocaleDateString('pt-AO') : '-';
    return [
      p.clienteNome,
      pecaLabels[p.tipoPeca] || p.tipoPeca,
      statusLabels[p.status] || p.status,
      formatarMoeda(p.valor, atelie),
      formatarMoeda(p.sinalPago, atelie),
      pendente > 0 ? formatarMoeda(pendente, atelie) : 'Pago Integral',
      `${dataCriacao}\nEntrega: ${dataEntrega}`
    ];
  });

  autoTable(doc, {
    startY: startY + cardHeight + 6,
    head: [['Cliente', 'Peça', 'Status', 'Total', 'Sinal', 'Pendente', 'Datas']],
    body: tableData.length > 0 ? tableData : [['Nenhum pedido registado no período seleccionado.', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 24 },
      2: { cellWidth: 26 },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 30, fontSize: 6.5 }
    },
    margin: { left: 14, right: 14 }
  });

  // 3. TABELA DE AUDITORIA DE CLIENTES COM PENDÊNCIAS
  if (stats.devList.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    
    // Adicionar quebra se couber apertado
    if (finalY > pageHeight - 65) {
      doc.addPage();
      drawHeader();
    }

    const currentY = (doc as any).lastAutoTable.finalY > pageHeight - 65 ? 36 : finalY + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28); // red-700
    doc.text('AUDITORIA DE CRÉDITO & COBRANÇA (CLIENTES COM SALDO EM FALTA)', 14, currentY);

    const devedoresRows = stats.devList.map(dev => [
      dev.cliente.nome,
      `+${dev.cliente.telefone}`,
      `${dev.pedidos.length} encomenda(s)`,
      formatarMoeda(dev.totalOwed, atelie)
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [['Cliente Devedora', 'Telefone / WhatsApp', 'Qtd. Encomendas', 'Total Pendente']],
      body: devedoresRows,
      theme: 'grid',
      headStyles: {
        fillColor: [185, 28, 28],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [254, 202, 202]
      },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 42, halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Desenhar rodapé em todas as páginas criadas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  // Nome do ficheiro limpo e profissional
  const sanitizedAtelie = atelie.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Relatorio_${sanitizedAtelie}_${dateStr}.pdf`;

  // Download imediato do PDF
  doc.save(fileName);
}

/**
 * Exporta Ficha de Medidas e Histórico do Cliente em PDF
 */
export function exportarFichaClientePDF(
  atelie: Atelie,
  cliente: Cliente,
  medidasList: Medidas[],
  pedidosList: Pedido[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cabeçalho da Ficha de Alfaiataria
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(0, 28, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(atelie.nome.toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`DOSSIER DE CLIENTE & FICHA DE MEDIDAS TÉCNICAS`, 14, 19);

  doc.setFontSize(8);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-AO')}`, pageWidth - 14, 12, { align: 'right' });
  doc.text(`Ateliê: +${atelie.telefone}`, pageWidth - 14, 19, { align: 'right' });

  // Bloco de Dados do Cliente
  let currentY = 38;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, pageWidth - 28, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(cliente.nome, 18, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Telefone: +${cliente.telefone}`, 18, currentY + 14);
  doc.text(`Email: ${cliente.email || 'Não informado'}`, 18, currentY + 19);

  const totalGasto = pedidosList.reduce((acc, p) => acc + (p.status !== 'cancelado' ? p.valor : 0), 0);
  const totalPendente = pedidosList.reduce((acc, p) => acc + (p.status !== 'cancelado' ? Math.max(0, p.valor - p.sinalPago) : 0), 0);

  doc.setFont('helvetica', 'bold');
  doc.text(`Histórico: ${pedidosList.length} encomendas`, pageWidth - 20, currentY + 7, { align: 'right' });
  doc.setTextColor(22, 101, 52);
  doc.text(`Investimento Total: ${formatarMoeda(totalGasto, atelie)}`, pageWidth - 20, currentY + 14, { align: 'right' });
  if (totalPendente > 0) {
    doc.setTextColor(185, 28, 28);
    doc.text(`Pendente: ${formatarMoeda(totalPendente, atelie)}`, pageWidth - 20, currentY + 19, { align: 'right' });
  }

  // Tabela de Medidas Técnicas
  currentY += 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('TABELA HISTÓRICA DE MEDIDAS (CENTÍMETROS)', 14, currentY);

  const medidasRows = medidasList.map(m => {
    const dataReg = new Date(m.registradoEm).toLocaleDateString('pt-AO');
    return [
      dataReg,
      m.busto ? `${m.busto} cm` : '-',
      m.cintura ? `${m.cintura} cm` : '-',
      m.quadril ? `${m.quadril} cm` : '-',
      m.ombro ? `${m.ombro} cm` : '-',
      m.comprimentoTronco ? `${m.comprimentoTronco} cm` : '-',
      m.comprimentoSaia ? `${m.comprimentoSaia} cm` : '-',
      m.comprimentoCalca ? `${m.comprimentoCalca} cm` : '-',
      m.manga ? `${m.manga} cm` : '-'
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Data', 'Busto', 'Cintura', 'Quadril', 'Ombro', 'Tronco', 'Saia', 'Calça', 'Manga']],
    body: medidasRows.length > 0 ? medidasRows : [['Nenhuma medição registada para este cliente.', '', '', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      halign: 'center'
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      halign: 'center',
      lineColor: [226, 232, 240]
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'left', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  // Tabela de Encomendas do Cliente
  const finalY = (doc as any).lastAutoTable.finalY || 130;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('HISTÓRICO DE ENCOMENDAS & PEÇAS', 14, finalY + 10);

  const pedidosRows = pedidosList.map(p => {
    const pendente = Math.max(0, p.valor - p.sinalPago);
    return [
      new Date(p.criadoEm).toLocaleDateString('pt-AO'),
      pecaLabels[p.tipoPeca] || p.tipoPeca,
      p.tecido || 'Não especificado',
      statusLabels[p.status] || p.status,
      formatarMoeda(p.valor, atelie),
      pendente > 0 ? formatarMoeda(pendente, atelie) : 'Liquidado'
    ];
  });

  autoTable(doc, {
    startY: finalY + 14,
    head: [['Data', 'Peça', 'Tecido', 'Status', 'Valor', 'Saldo Pendente']],
    body: pedidosRows.length > 0 ? pedidosRows : [['Nenhuma encomenda registada para este cliente.', '', '', '', '', '']],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      lineColor: [226, 232, 240]
    },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  // Rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`FlowTailor • Ficha de Cliente: ${cliente.nome}`, 14, pageHeight - 7);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  const cleanClient = cliente.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`Ficha_${cleanClient}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Exporta Recibo / Comprovativo Comercial de Encomenda em PDF
 */
export function exportarReciboPedidoPDF(
  atelie: Atelie,
  pedido: Pedido
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5' // Formato A5 elegante para recibos de alfaiataria
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cabeçalho A5
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(0, 24, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(atelie.nome.toUpperCase(), 12, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`COMPROVATIVO & RECIBO DE ENCOMENDA`, 12, 17);

  const numPedido = pedido.id.slice(-6).toUpperCase();
  doc.setFontSize(8);
  doc.text(`Nº: #${numPedido}`, pageWidth - 12, 11, { align: 'right' });
  doc.text(`Data: ${new Date(pedido.criadoEm).toLocaleDateString('pt-AO')}`, pageWidth - 12, 17, { align: 'right' });

  // Detalhes da Encomenda
  let currentY = 32;

  // Box Cliente
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, currentY, pageWidth - 24, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE', 16, currentY + 6);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(pedido.clienteNome, 16, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Contacto: +${pedido.clienteTelefone}`, 16, currentY + 17);

  // Box Especificações do Pedido
  currentY += 24;

  const dataEntregaStr = pedido.prazoEntrega ? new Date(pedido.prazoEntrega).toLocaleDateString('pt-AO') : 'A combinar';
  const pendente = Math.max(0, pedido.valor - pedido.sinalPago);

  autoTable(doc, {
    startY: currentY,
    head: [['Descrição do Serviço / Peça', 'Detalhe']],
    body: [
      ['Tipo de Peça', pecaLabels[pedido.tipoPeca] || pedido.tipoPeca],
      ['Tecido Informado', pedido.tecido || 'Fornecido pelo cliente'],
      ['Prazo de Entrega', dataEntregaStr],
      ['Estado da Peça', statusLabels[pedido.status] || pedido.status],
      ['Observações / Detalhes', pedido.observacoes || 'Sem notas especiais']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [226, 232, 240]
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 75 }
    },
    margin: { left: 12, right: 12 }
  });

  // Resumo Financeiro
  const finalTableY = (doc as any).lastAutoTable.finalY || 100;
  const financeY = finalTableY + 6;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(12, financeY, pageWidth - 24, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Valor Total do Serviço:', 16, financeY + 7);
  doc.text(formatarMoeda(pedido.valor, atelie), pageWidth - 16, financeY + 7, { align: 'right' });

  doc.setTextColor(22, 101, 52);
  doc.text('Sinal / Valor Pago:', 16, financeY + 13);
  doc.text(formatarMoeda(pedido.sinalPago, atelie), pageWidth - 16, financeY + 13, { align: 'right' });

  doc.setFontSize(9.5);
  if (pendente > 0) {
    doc.setTextColor(185, 28, 28);
    doc.text('Saldo Restante na Entrega:', 16, financeY + 20);
    doc.text(formatarMoeda(pendente, atelie), pageWidth - 16, financeY + 20, { align: 'right' });
  } else {
    doc.setTextColor(22, 101, 52);
    doc.text('Estado Financeiro:', 16, financeY + 20);
    doc.text('TOTALMENTE LIQUIDADO ✓', pageWidth - 16, financeY + 20, { align: 'right' });
  }

  // Rodapé do Recibo
  doc.setDrawColor(226, 232, 240);
  doc.line(12, pageHeight - 14, pageWidth - 12, pageHeight - 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${atelie.nome} • Agradecemos a sua preferência!`, 12, pageHeight - 8);
  doc.text(`Documento emitido via FlowTailor`, pageWidth - 12, pageHeight - 8, { align: 'right' });

  doc.save(`Recibo_Encomenda_${numPedido}.pdf`);
}
