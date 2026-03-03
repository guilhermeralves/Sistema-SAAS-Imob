export type CepLookupData = {
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export type CepLookupResult =
  | { status: "success"; data: CepLookupData }
  | { status: "not_found" }
  | { status: "service_unavailable" };

function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "");
}

async function fetchViaCep(cep: string): Promise<CepLookupResult> {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) {
    return { status: "service_unavailable" };
  }

  const data = await response.json();
  if (data.erro) {
    return { status: "not_found" };
  }

  return {
    status: "success",
    data: {
      endereco: data.logradouro || "",
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      estado: data.uf || "",
    },
  };
}

async function fetchBrasilApi(cep: string): Promise<CepLookupResult> {
  const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
  if (response.status === 404) {
    return { status: "not_found" };
  }

  if (!response.ok) {
    return { status: "service_unavailable" };
  }

  const data = await response.json();
  return {
    status: "success",
    data: {
      endereco: data.street || "",
      bairro: data.neighborhood || "",
      cidade: data.city || "",
      estado: data.state || "",
    },
  };
}

export async function lookupCep(cep: string): Promise<CepLookupResult> {
  const cepLimpo = normalizeCep(cep);
  if (cepLimpo.length !== 8) {
    return { status: "not_found" };
  }

  const results: CepLookupResult[] = [];

  try {
    const viaCepResult = await fetchViaCep(cepLimpo);
    if (viaCepResult.status === "success") {
      return viaCepResult;
    }
    results.push(viaCepResult);
  } catch {
    results.push({ status: "service_unavailable" });
  }

  try {
    const brasilApiResult = await fetchBrasilApi(cepLimpo);
    if (brasilApiResult.status === "success") {
      return brasilApiResult;
    }
    results.push(brasilApiResult);
  } catch {
    results.push({ status: "service_unavailable" });
  }

  if (results.some(result => result.status === "not_found")) {
    return { status: "not_found" };
  }

  return { status: "service_unavailable" };
}
