/**
 * Script de Seed para Popular o Banco de Dados
 * 
 * Este script cria dados de exemplo para facilitar o desenvolvimento e testes.
 * 
 * Para executar: node seed.mjs
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { users, properties, leads, contracts, documents, leadNotes } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

async function seed() {
  console.log("🌱 Iniciando seed do banco de dados...");

  try {
    // Criar usuários de exemplo
    console.log("📝 Criando usuários...");
    
    // Nota: Os usuários reais serão criados via OAuth
    // Este seed é apenas para referência de estrutura
    
    // Criar imóveis de exemplo
    console.log("🏠 Criando imóveis...");
    
    const imoveis = [
      {
        titulo: "Apartamento 3 Quartos no Centro",
        descricao: "Lindo apartamento com 3 quartos, 2 banheiros, sala ampla, cozinha planejada e 2 vagas de garagem. Localizado no coração da cidade, próximo a comércios e serviços.",
        tipo: "apartamento",
        finalidade: "venda",
        valor: 45000000, // R$ 450.000,00 em centavos
        valorLocacao: null,
        area: 120,
        quartos: 3,
        banheiros: 2,
        vagas: 2,
        endereco: "Rua das Flores, 123",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01000-000",
        latitude: null,
        longitude: null,
        fotos: JSON.stringify([]),
        status: "ativo",
        destaque: 1,
        idCorretor: 1, // Será atualizado com ID real
      },
      {
        titulo: "Casa com Piscina em Condomínio Fechado",
        descricao: "Casa térrea com 4 quartos sendo 2 suítes, sala de estar, sala de jantar, cozinha gourmet, área de lazer com piscina e churrasqueira. Condomínio com segurança 24h.",
        tipo: "casa",
        finalidade: "venda",
        valor: 85000000, // R$ 850.000,00
        valorLocacao: null,
        area: 250,
        quartos: 4,
        banheiros: 3,
        vagas: 3,
        endereco: "Alameda dos Ipês, 456",
        bairro: "Jardim Europa",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01400-000",
        latitude: null,
        longitude: null,
        fotos: JSON.stringify([]),
        status: "ativo",
        destaque: 1,
        idCorretor: 1,
      },
      {
        titulo: "Apartamento 2 Quartos para Locação",
        descricao: "Apartamento confortável com 2 quartos, banheiro social, sala, cozinha e 1 vaga. Prédio com portaria 24h.",
        tipo: "apartamento",
        finalidade: "locacao",
        valor: 30000000, // Valor de venda
        valorLocacao: 250000, // R$ 2.500,00/mês
        area: 80,
        quartos: 2,
        banheiros: 1,
        vagas: 1,
        endereco: "Rua dos Pinheiros, 789",
        bairro: "Pinheiros",
        cidade: "São Paulo",
        estado: "SP",
        cep: "05400-000",
        latitude: null,
        longitude: null,
        fotos: JSON.stringify([]),
        status: "ativo",
        destaque: 1,
        idCorretor: 1,
      },
      {
        titulo: "Sala Comercial no Centro Empresarial",
        descricao: "Sala comercial de 50m² em excelente localização, com 2 banheiros, copa e recepção. Prédio moderno com elevadores e estacionamento.",
        tipo: "comercial",
        finalidade: "locacao",
        valor: 40000000,
        valorLocacao: 350000, // R$ 3.500,00/mês
        area: 50,
        quartos: null,
        banheiros: 2,
        vagas: 2,
        endereco: "Avenida Paulista, 1000",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01310-000",
        latitude: null,
        longitude: null,
        fotos: JSON.stringify([]),
        status: "ativo",
        destaque: 0,
        idCorretor: 1,
      },
    ];

    for (const imovel of imoveis) {
      await db.insert(properties).values(imovel);
    }

    console.log("✅ Seed concluído com sucesso!");
    console.log("\n📊 Dados criados:");
    console.log(`   - ${imoveis.length} imóveis`);
    console.log("\n⚠️  Nota: Usuários serão criados automaticamente via OAuth ao fazer login");
    
  } catch (error) {
    console.error("❌ Erro ao executar seed:", error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("\n✨ Seed finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erro fatal:", error);
    process.exit(1);
  });
