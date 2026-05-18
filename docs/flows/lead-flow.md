# Fluxo de Leads

## Objetivo

Organizar o ciclo de entrada, distribuição e acompanhamento de leads imobiliários.

## Possíveis origens

- formulário do site;
- campanhas Meta Ads;
- OLX;
- Zap Imóveis;
- Viva Real;
- importações futuras;
- APIs externas.

## Fluxo esperado

```text
Entrada do lead
      ↓
Validação de dados
      ↓
Criação no CRM
      ↓
Atribuição para corretor
      ↓
Acompanhamento
      ↓
Conversão ou encerramento
```

## Informações importantes do lead

- nome;
- telefone;
- email;
- origem;
- imóvel relacionado;
- corretor responsável;
- status;
- timestamps.

## Regras importantes

- Leads devem possuir histórico de alterações futuramente.
- Corretores devem ver apenas leads atribuídos.
- Admin possui acesso global.
- Origem do lead deve ser preservada para análise de marketing.
