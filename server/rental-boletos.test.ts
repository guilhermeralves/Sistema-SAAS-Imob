import { describe, expect, it } from "vitest";
import {
  buildBoletoDueDate,
  buildRentalBoletoSchedule,
  calculateBoletoTotal,
  getBoletoSetStatus,
  getBoletoTemporalStatus,
  pickCurrentBoleto,
} from "../shared/rental-boletos";

describe("buildRentalBoletoSchedule", () => {
  it("gera uma parcela por mes de vigencia", () => {
    const schedule = buildRentalBoletoSchedule({
      startDate: "2026-06-15",
      dueDay: 10,
      leaseTermMonths: 30,
      rentAmount: 200000,
      condominiumAmount: 50000,
    });
    expect(schedule).toHaveLength(30);
    expect(schedule[0].installmentNumber).toBe(1);
    expect(schedule[29].installmentNumber).toBe(30);
  });

  it("usa o mes de inicio como primeira competencia e o dia de vencimento informado", () => {
    const schedule = buildRentalBoletoSchedule({
      startDate: "2026-06-15",
      dueDay: 10,
      leaseTermMonths: 3,
      rentAmount: 200000,
      condominiumAmount: 50000,
    });
    expect(schedule[0].referenceMonth).toBe("2026-06-01");
    expect(schedule[0].dueDate).toBe("2026-06-10");
    expect(schedule[1].dueDate).toBe("2026-07-10");
    expect(schedule[2].dueDate).toBe("2026-08-10");
  });

  it("vira o ano corretamente", () => {
    const schedule = buildRentalBoletoSchedule({
      startDate: "2026-11-01",
      dueDay: 5,
      leaseTermMonths: 4,
      rentAmount: 100000,
      condominiumAmount: null,
    });
    expect(schedule.map(item => item.dueDate)).toEqual([
      "2026-11-05",
      "2026-12-05",
      "2027-01-05",
      "2027-02-05",
    ]);
  });

  it("faz clamp do dia de vencimento em meses curtos", () => {
    const schedule = buildRentalBoletoSchedule({
      startDate: "2026-01-31",
      dueDay: 31,
      leaseTermMonths: 3,
      rentAmount: 100000,
      condominiumAmount: null,
    });
    expect(schedule[0].dueDate).toBe("2026-01-31");
    expect(schedule[1].dueDate).toBe("2026-02-28");
    expect(schedule[2].dueDate).toBe("2026-03-31");
  });

  it("soma aluguel + condominio no total e zera condominio quando ausente", () => {
    const withCondo = buildRentalBoletoSchedule({
      startDate: "2026-06-01",
      dueDay: 10,
      leaseTermMonths: 1,
      rentAmount: 200000,
      condominiumAmount: 50000,
    });
    expect(withCondo[0].totalAmount).toBe(250000);
    expect(withCondo[0].condominiumAmount).toBe(50000);

    const withoutCondo = buildRentalBoletoSchedule({
      startDate: "2026-06-01",
      dueDay: 10,
      leaseTermMonths: 1,
      rentAmount: 200000,
      condominiumAmount: null,
    });
    expect(withoutCondo[0].totalAmount).toBe(200000);
    expect(withoutCondo[0].condominiumAmount).toBeNull();
  });

  it("aceita Date (meia-noite UTC) como data de inicio", () => {
    const schedule = buildRentalBoletoSchedule({
      startDate: new Date("2026-06-15T00:00:00.000Z"),
      dueDay: 10,
      leaseTermMonths: 2,
      rentAmount: 100000,
    });
    expect(schedule[0].referenceMonth).toBe("2026-06-01");
    expect(schedule[1].dueDate).toBe("2026-07-10");
  });

  it("retorna lista vazia quando a vigencia e zero", () => {
    expect(
      buildRentalBoletoSchedule({
        startDate: "2026-06-15",
        dueDay: 10,
        leaseTermMonths: 0,
        rentAmount: 100000,
      })
    ).toEqual([]);
  });
});

describe("buildBoletoDueDate", () => {
  it("faz clamp para o ultimo dia do mes", () => {
    expect(buildBoletoDueDate(2026, 1, 31)).toBe("2026-02-28");
    expect(buildBoletoDueDate(2024, 1, 31)).toBe("2024-02-29");
  });
});

describe("calculateBoletoTotal", () => {
  it("soma os componentes ignorando negativos e nulos", () => {
    expect(
      calculateBoletoTotal({ rentAmount: 200000, condominiumAmount: 50000, extraAmount: 1000 })
    ).toBe(251000);
    expect(
      calculateBoletoTotal({ rentAmount: 200000, condominiumAmount: null })
    ).toBe(200000);
    expect(
      calculateBoletoTotal({ rentAmount: 200000, condominiumAmount: -5, extraAmount: -10 })
    ).toBe(200000);
  });
});

describe("getBoletoTemporalStatus", () => {
  const today = "2026-06-10";

  it("retorna pago quando ha baixa de pagamento, mesmo vencido", () => {
    expect(
      getBoletoTemporalStatus({ dueDate: "2026-01-01", paidAt: "2026-01-02" }, today)
    ).toBe("pago");
  });

  it("retorna em_aberto quando vence hoje ou no futuro", () => {
    expect(getBoletoTemporalStatus({ dueDate: "2026-06-10" }, today)).toBe("em_aberto");
    expect(getBoletoTemporalStatus({ dueDate: "2026-06-20" }, today)).toBe("em_aberto");
  });

  it("retorna atrasado ate 2 dias apos o vencimento", () => {
    expect(getBoletoTemporalStatus({ dueDate: "2026-06-09" }, today)).toBe("atrasado");
    expect(getBoletoTemporalStatus({ dueDate: "2026-06-08" }, today)).toBe("atrasado");
  });

  it("retorna vencido apos 2 dias do vencimento", () => {
    expect(getBoletoTemporalStatus({ dueDate: "2026-06-07" }, today)).toBe("vencido");
    expect(getBoletoTemporalStatus({ dueDate: "2026-05-01" }, today)).toBe("vencido");
  });
});

describe("pickCurrentBoleto / getBoletoSetStatus", () => {
  const today = "2026-06-10";

  it("escolhe o boleto em aberto mais antigo ja vencido", () => {
    const boletos = [
      { installmentNumber: 1, dueDate: "2026-04-10", paidAt: "2026-04-10" },
      { installmentNumber: 2, dueDate: "2026-05-10", paidAt: null },
      { installmentNumber: 3, dueDate: "2026-06-10", paidAt: null },
    ];
    expect(pickCurrentBoleto(boletos, today)?.installmentNumber).toBe(2);
    expect(getBoletoSetStatus(boletos, today)).toBe("vencido");
  });

  it("escolhe o proximo a vencer quando nao ha vencidos", () => {
    const boletos = [
      { installmentNumber: 1, dueDate: "2026-05-10", paidAt: "2026-05-09" },
      { installmentNumber: 2, dueDate: "2026-06-20", paidAt: null },
    ];
    expect(pickCurrentBoleto(boletos, today)?.installmentNumber).toBe(2);
    expect(getBoletoSetStatus(boletos, today)).toBe("em_aberto");
  });

  it("retorna a ultima parcela paga quando todas estao pagas", () => {
    const boletos = [
      { installmentNumber: 1, dueDate: "2026-05-10", paidAt: "2026-05-09" },
      { installmentNumber: 2, dueDate: "2026-06-10", paidAt: "2026-06-09" },
    ];
    expect(pickCurrentBoleto(boletos, today)?.installmentNumber).toBe(2);
    expect(getBoletoSetStatus(boletos, today)).toBe("pago");
  });

  it("retorna null para conjunto vazio", () => {
    expect(pickCurrentBoleto([], today)).toBeNull();
    expect(getBoletoSetStatus([], today)).toBeNull();
  });
});
