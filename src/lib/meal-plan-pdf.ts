import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { MealPlan, MealPlanItem, Nutritionist } from '../types';
import { isRichTextHtml } from './rich-text';

type ReceitaVinculada = {
  meal: string;
  recipe: {
    name: string;
    ingredients: Array<{ name: string; quantity: string; unit: string }>;
    prepMode?: string;
  };
};

interface StyledToken {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function fontStyleFor(bold: boolean, italic: boolean): 'normal' | 'bold' | 'italic' | 'bolditalic' {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function collectTokens(
  node: Node,
  bold: boolean,
  italic: boolean,
  underline: boolean,
  tokens: StyledToken[]
): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      (child.textContent || '')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word) => tokens.push({ text: word, bold, italic, underline }));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const el = child as HTMLElement;
    switch (el.tagName.toLowerCase()) {
      case 'strong':
        collectTokens(el, true, italic, underline, tokens);
        break;
      case 'em':
        collectTokens(el, bold, true, underline, tokens);
        break;
      case 'u':
        collectTokens(el, bold, italic, true, tokens);
        break;
      default:
        collectTokens(el, bold, italic, underline, tokens);
    }
  });
}

/**
 * Exportada apenas para testes (src/tests/lib/meal-plan-pdf.test.ts).
 */
export function renderFreeTextToPdf(
  doc: jsPDF,
  content: string,
  startY: number,
  x: number,
  maxWidth: number
): number {
  let currentY = startY;
  const lineHeight = 5;

  const ensureSpace = (needed = lineHeight) => {
    if (currentY + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      currentY = 20;
    }
  };

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  if (!isRichTextHtml(content)) {
    const splitFreeText = doc.splitTextToSize(content || '', maxWidth);
    for (const linha of splitFreeText) {
      ensureSpace();
      doc.text(linha, x, currentY);
      currentY += lineHeight;
    }
    return currentY;
  }

  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h3', 'ul', 'ol', 'li'],
  });
  const dom = new DOMParser().parseFromString(sanitized, 'text/html');

  const renderTokens = (tokens: StyledToken[], startX: number, width: number) => {
    if (tokens.length === 0) return;

    const spaceWidth = doc.getTextWidth(' ');
    let cursorX = startX;
    ensureSpace(lineHeight);

    tokens.forEach((token) => {
      doc.setFont('helvetica', fontStyleFor(token.bold, token.italic));
      const wordWidth = doc.getTextWidth(token.text);

      if (cursorX !== startX && cursorX + wordWidth > startX + width) {
        currentY += lineHeight;
        ensureSpace(lineHeight);
        cursorX = startX;
      }

      doc.text(token.text, cursorX, currentY);
      if (token.underline) {
        doc.line(cursorX, currentY + 0.5, cursorX + wordWidth, currentY + 0.5);
      }
      cursorX += wordWidth + spaceWidth;
    });

    doc.setFont('helvetica', 'normal');
    currentY += lineHeight;
  };

  dom.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;

    switch (el.tagName.toLowerCase()) {
      case 'h3': {
        const tokens: StyledToken[] = [];
        collectTokens(el, true, false, false, tokens);
        ensureSpace(lineHeight + 2);
        currentY += 2;
        doc.setFontSize(11);
        renderTokens(tokens, x, maxWidth);
        doc.setFontSize(10);
        currentY += 2;
        break;
      }
      case 'p': {
        const tokens: StyledToken[] = [];
        collectTokens(el, false, false, false, tokens);
        renderTokens(tokens, x, maxWidth);
        currentY += 2;
        break;
      }
      case 'ul':
      case 'ol': {
        let counter = 0;
        el.childNodes.forEach((liNode) => {
          if (liNode.nodeType !== Node.ELEMENT_NODE) return;
          const li = liNode as HTMLElement;
          if (li.tagName.toLowerCase() !== 'li') return;

          counter += 1;
          const marker = el.tagName.toLowerCase() === 'ol' ? `${counter}.` : '•';
          const tokens: StyledToken[] = [{ text: marker, bold: false, italic: false, underline: false }];
          collectTokens(li, false, false, false, tokens);
          renderTokens(tokens, x + 4, maxWidth - 4);
        });
        currentY += 2;
        break;
      }
      default:
        break;
    }
  });

  return currentY;
}

export function generateMealPlanPDF(
  plan: MealPlan,
  items: MealPlanItem[],
  patientName: string,
  nutritionist: Nutritionist | null,
  receitasVinculadas?: ReceitaVinculada[]
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(5, 150, 105); // emerald-600
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANO ALIMENTAR', pageWidth / 2, 20, { align: 'center' });

  // Nutritionist Info in Header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nutricionista: ${nutritionist?.name || 'Não informado'}`, pageWidth / 2, 28, { align: 'center' });

  let headerY = 33;
  if (nutritionist?.crn) {
    doc.text(`CRN: ${nutritionist.crn}`, pageWidth / 2, headerY, { align: 'center' });
    headerY += 5;
  }
  if (nutritionist?.phone) {
    doc.text(`Tel: ${nutritionist.phone}`, pageWidth / 2, headerY, { align: 'center' });
  }

  // Patient Info Section
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO PACIENTE', 14, 60);
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 62, pageWidth - 14, 62);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Paciente:', 14, 70);
  doc.setFont('helvetica', 'normal');
  doc.text(patientName || 'Não informado', 35, 70);

  doc.setFont('helvetica', 'bold');
  doc.text('Data:', 14, 77);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(), 'dd/MM/yyyy'), 28, 77);

  doc.setFont('helvetica', 'bold');
  doc.text('Plano:', 14, 84);
  doc.setFont('helvetica', 'normal');
  doc.text(plan.name || 'Plano Alimentar', 30, 84);

  let currentY = 95;
  if (plan.waterIntake) {
    doc.setFont('helvetica', 'bold');
    doc.text('Meta de Água:', 14, 91);
    doc.setFont('helvetica', 'normal');
    doc.text(plan.waterIntake, 43, 91);
    currentY = 102;
  }

  if (plan.type === 'free') {
    // Modo Livre: renderiza o texto colado como texto corrido, sem tabelas por bloco
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANO ALIMENTAR', 14, currentY);
    doc.line(14, currentY + 2, pageWidth - 14, currentY + 2);
    currentY += 10;

    currentY = renderFreeTextToPdf(doc, plan.freeTextContent || '', currentY, 14, pageWidth - 28);
    currentY += 10;
  } else {
    // Group items by meal
    const mealsToDisplay = plan.customMeals && plan.customMeals.length > 0 ? plan.customMeals : [];

    mealsToDisplay.forEach((meal) => {
      const mealItems = items.filter(i => i.meal === meal.id);
      const observation = (plan.mealObservations as Record<string, string> | undefined)?.[meal.id];
      if (mealItems.length === 0 && !observation) return;

      const mealLabel = meal.label;
      const mealTime = meal.time ? ` (${meal.time})` : '';

      // Meal Header
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, currentY, pageWidth - 28, 10, 'F');
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${mealLabel.toUpperCase()}${mealTime}`, 18, currentY + 7);

      currentY += 12;

      if (mealItems.length > 0) {
        const tableData = mealItems.map(item => [
          item.food,
          `${item.quantity} ${item.unit}`,
          `${item.kcal || 0} kcal`
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Alimento', 'Quantidade', 'Calorias']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [5, 150, 105], fontSize: 9, halign: 'center' },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 'auto', halign: 'left' },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 30, halign: 'center' }
          },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            if (data.section === 'head' && data.column.index === 0) {
              data.cell.styles.halign = 'left';
            }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
      }

      if (observation) {
        const splitObs = doc.splitTextToSize(observation, pageWidth - 36);
        const obsHeight = (splitObs.length * 5) + 6;

        if (currentY + obsHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          currentY = 20;
        }

        // setFillColor e setDrawColor sempre imediatamente antes do rect,
        // pois autoTable e addPage podem resetar o estado de cores do jsPDF
        doc.setFillColor(255, 251, 235); // amber-50
        doc.setDrawColor(251, 191, 36); // amber-400
        doc.rect(14, currentY, pageWidth - 28, obsHeight, 'F');
        doc.line(14, currentY, 14, currentY + obsHeight);

        doc.setTextColor(146, 64, 14); // amber-800
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(splitObs, 18, currentY + 5);

        currentY += obsHeight + 10;
      } else {
        currentY += 5;
      }

      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      }
    });
  }

  // General Instructions
  if (plan.generalInstructions) {
    if (currentY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ORIENTAÇÕES GERAIS', 14, currentY + 10);
    doc.line(14, currentY + 12, pageWidth - 14, currentY + 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitInstructions = doc.splitTextToSize(plan.generalInstructions, pageWidth - 28);
    doc.text(splitInstructions, 14, currentY + 20);
    currentY += 20 + (splitInstructions.length * 5) + 15;
  }

  if (plan.type !== 'free') {
    // Household Measurements Table
    if (currentY > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('EQUIVALÊNCIA DE MEDIDAS CASEIRAS', 14, currentY);
    currentY += 5;

    const householdMeasures = [
      ['1 copo americano', '200 ml'],
      ['1 xícara de chá', '200 ml'],
      ['1 copo de requeijão', '250 ml'],
      ['1 concha média', '100 g / 150 ml'],
      ['1 colher de sopa', '15 g / 15 ml'],
      ['1 colher de sobremesa', '10 g / 10 ml'],
      ['1 colher de chá', '5 g / 5 ml'],
      ['1 colher de café', '2.5 g / 2.5 ml'],
      ['1 escumadeira média', '60 g']
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Medida Caseira', 'Equivalência Aproximada']],
      body: householdMeasures,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 60, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Receitas vinculadas
    if (receitasVinculadas && receitasVinculadas.length > 0) {
      const grupos = new Map<string, typeof receitasVinculadas>();
      for (const link of receitasVinculadas) {
        if (!grupos.has(link.meal)) grupos.set(link.meal, []);
        const grupo = grupos.get(link.meal)!;
        const jaExiste = grupo.some((l) => l.recipe.name === link.recipe.name);
        if (!jaExiste) grupo.push(link);
      }

      if (currentY > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        currentY = 20;
      }

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('RECEITAS', 14, currentY + 10);
      doc.line(14, currentY + 12, pageWidth - 14, currentY + 12);
      currentY += 20;

      for (const [meal, links] of grupos) {
        if (currentY > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(meal.toUpperCase(), 14, currentY);
        currentY += 3;
        doc.setDrawColor(203, 213, 225);
        doc.line(14, currentY, pageWidth - 14, currentY);
        currentY += 6;

        for (const { recipe } of links) {
          if (currentY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFillColor(241, 245, 249);
          doc.rect(14, currentY, pageWidth - 28, 10, 'F');
          doc.setTextColor(15, 23, 42);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(recipe.name, 18, currentY + 7);
          currentY += 14;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.text('Ingredientes:', 14, currentY);
          currentY += 5;

          recipe.ingredients.forEach((ing) => {
            if (currentY > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              currentY = 20;
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text(`• ${ing.quantity} ${ing.unit} de ${ing.name}`, 18, currentY);
            currentY += 5;
          });

          if (recipe.prepMode) {
            currentY += 3;
            if (currentY > doc.internal.pageSize.getHeight() - 30) {
              doc.addPage();
              currentY = 20;
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text('Modo de Preparo:', 14, currentY);
            currentY += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            const splitPrepMode = doc.splitTextToSize(recipe.prepMode, pageWidth - 28);
            splitPrepMode.forEach((linha: string) => {
              if (currentY > doc.internal.pageSize.getHeight() - 15) {
                doc.addPage();
                currentY = 20;
              }
              doc.text(linha, 14, currentY);
              currentY += 5;
            });
          }

          currentY += 8;
        }

        currentY += 6;
      }
    }
  }

  // Signature and Stamp Area
  if (currentY > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    currentY = 30;
  } else {
    currentY += 30;
  }

  doc.setDrawColor(148, 163, 184); // slate-400
  doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Assinatura do Profissional', pageWidth / 2, currentY + 5, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.rect(pageWidth - 54, currentY - 15, 40, 25);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('ESPAÇO PARA CARIMBO', pageWidth - 34, currentY - 2, { align: 'center' });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Gerado por Nutrir em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return doc;
}
