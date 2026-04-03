/**
 * Módulo generador de reportes en PDF para CarSiGo.
 * Utiliza jsPDF y jspdf-autotable para crear documentos bien formateados.
 * Se ejecuta completamente del lado del cliente (importación dinámica).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type Settlement = {
  reference: string;
  total_amount: number;
  volume_base?: number;
  drivers_involved: number;
  created_at: string;
  status: string;
};

/**
 * Genera y descarga un reporte PDF del historial de liquidaciones.
 * Incluye membrete de CarSiGo, tabla de datos y pie de página.
 */
export function generateSettlementPDF(settlements: Settlement[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ─── COLORES DE MARCA ──────────────────────────────────────────────────
  const cianCarSiGo: [number, number, number] = [0, 229, 255];
  const oscuro: [number, number, number] = [19, 19, 19];
  const grisClaro: [number, number, number] = [245, 247, 250];

  // ─── FONDO DEL ENCABEZADO ──────────────────────────────────────────────
  doc.setFillColor(...oscuro);
  doc.rect(0, 0, 210, 42, 'F');

  // ─── NOMBRE DE LA EMPRESA ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...cianCarSiGo);
  doc.text('CarSiGo', 20, 20);

  doc.setFontSize(9);
  doc.setTextColor(160, 180, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('PLATAFORMA DE MOVILIDAD · PANEL ADMINISTRATIVO', 20, 27);

  // ─── TÍTULO DEL REPORTE ────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('REPORTE DE LIQUIDACIONES', 20, 37);

  // ─── FECHA DE GENERACIÓN (alineada a la derecha) ───────────────────────
  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  doc.setFontSize(9);
  doc.setTextColor(160, 180, 200);
  doc.text(`Generado: ${fechaHoy}`, 190, 37, { align: 'right' });

  // ─── RESUMEN FINANCIERO ────────────────────────────────────────────────
  const totalComision = settlements.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalVolumen = settlements.reduce((sum, s) => sum + (s.volume_base || 0), 0);

  doc.setFillColor(...grisClaro);
  doc.roundedRect(15, 48, 55, 22, 3, 3, 'F');
  doc.roundedRect(78, 48, 55, 22, 3, 3, 'F');
  doc.roundedRect(141, 48, 55, 22, 3, 3, 'F');

  // Bloque 1: Total liquidaciones
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...oscuro);
  doc.text(`${settlements.length}`, 42, 59, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 120, 140);
  doc.text('TOTAL LIQUIDACIONES', 42, 65, { align: 'center' });

  // Bloque 2: Comisión total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...oscuro);
  doc.text(`$${totalComision.toLocaleString('es-CO')}`, 105, 59, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 120, 140);
  doc.text('COMISIÓN TOTAL (12%)', 105, 65, { align: 'center' });

  // Bloque 3: Volumen base
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...oscuro);
  doc.text(totalVolumen > 0 ? `$${totalVolumen.toLocaleString('es-CO')}` : 'N/A', 168, 59, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 120, 140);
  doc.text('VOLUMEN BASE', 168, 65, { align: 'center' });

  // ─── TABLA DE DATOS ────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 76,
    head: [['Referencia', 'Comisión', 'Volumen Base', 'Conductores', 'Fecha', 'Estado']],
    body: settlements.map(s => [
      s.reference,
      `$${(s.total_amount || 0).toLocaleString('es-CO')}`,
      s.volume_base ? `$${Number(s.volume_base).toLocaleString('es-CO')}` : '—',
      String(s.drivers_involved),
      new Date(s.created_at).toLocaleDateString('es-CO'),
      s.status.toUpperCase(),
    ]),
    headStyles: {
      fillColor: oscuro,
      textColor: cianCarSiGo,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [40, 50, 60],
    },
    alternateRowStyles: {
      fillColor: grisClaro,
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { textColor: [5, 150, 105], fontStyle: 'bold', halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', textColor: [5, 150, 105] },
    },
    margin: { left: 15, right: 15 },
  });

  // ─── PIE DE PÁGINA ──────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;
    doc.setDrawColor(220, 225, 230);
    doc.line(15, pageHeight - 15, 195, pageHeight - 15);
    doc.setFontSize(7);
    doc.setTextColor(150, 160, 170);
    doc.setFont('helvetica', 'normal');
    doc.text('CarSiGo · Reporte Confidencial · Generado automáticamente por el Panel Administrativo', 15, pageHeight - 8);
    doc.text(`Pág. ${i} / ${totalPages}`, 195, pageHeight - 8, { align: 'right' });
  }

  // ─── DESCARGA ──────────────────────────────────────────────────────────
  const filename = `CarSiGo_Liquidaciones_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
