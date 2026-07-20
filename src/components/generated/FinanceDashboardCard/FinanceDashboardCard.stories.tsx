import type { Meta, StoryObj } from "@storybook/react";
import FinanceDashboardCard from "./FinanceDashboardCard";

const meta: Meta<typeof FinanceDashboardCard> = {
  title: "Generated/FinanceDashboardCard",
  component: FinanceDashboardCard,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof FinanceDashboardCard>;

export const Default: Story = {
  args: {
    title: "Dashboard financiero",
    periodLabel: "Últimos 30 días",
    primaryKpiLabel: "Balance",
    primaryKpiValue: "$ 12.450.000",
    primaryKpiDelta: 4.2,
    secondaryKpiLabel: "Ingresos",
    secondaryKpiValue: "$ 3.250.000",
    secondaryKpiDelta: 2.1,
    tertiaryKpiLabel: "Gastos",
    tertiaryKpiValue: "$ 1.980.000",
    tertiaryKpiDelta: -1.4,
    note: "Actualizado hace 5 min",
    ctaLabel: "Ver dashboard",
    sparkline: [32, 40, 36, 52, 48, 60, 58, 66, 62, 74, 70, 82],
    onCtaClick: () => alert("CTA: Ver dashboard"),
  },
};

export const ExecutiveWeekly: Story = {
  args: {
    title: "Resumen ejecutivo",
    periodLabel: "Semana actual",
    primaryKpiLabel: "Patrimonio",
    primaryKpiValue: "USD 245,900",
    primaryKpiDelta: 1.8,
    secondaryKpiLabel: "Cash-in",
    secondaryKpiValue: "USD 41,250",
    secondaryKpiDelta: 0.6,
    tertiaryKpiLabel: "Cash-out",
    tertiaryKpiValue: "USD 18,120",
    tertiaryKpiDelta: -0.9,
    note: "Cierre parcial — 14:32",
    ctaLabel: "Abrir",
    sparkline: [65, 62, 64, 60, 58, 59, 61, 63, 66, 70, 72, 74],
    onCtaClick: () => alert("Abrir dashboard"),
  },
};

export const ClickableCard: Story = {
  args: {
    title: "Cartera & Mora",
    periodLabel: "Mes en curso",
    primaryKpiLabel: "Cartera",
    primaryKpiValue: "$ 890.000.000",
    primaryKpiDelta: 0.9,
    secondaryKpiLabel: "Mora 30+",
    secondaryKpiValue: "2,4%",
    secondaryKpiDelta: -0.2,
    tertiaryKpiLabel: "Recupero",
    tertiaryKpiValue: "$ 44.200.000",
    tertiaryKpiDelta: 3.4,
    note: "Sync: hace 1 min",
    ctaLabel: "Ver detalle",
    sparkline: [48, 46, 44, 43, 41, 40, 39, 38, 39, 37, 36, 35],
    onCardClick: () => alert("Card click: abrir dashboard"),
    onCtaClick: () => alert("CTA click"),
  },
};
