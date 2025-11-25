CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idCliente` int NOT NULL,
	`idImovel` int NOT NULL,
	`tipo` varchar(20) NOT NULL,
	`valor` int NOT NULL,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp,
	`status` varchar(20) NOT NULL DEFAULT 'ativo',
	`urlContrato` varchar(500),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idUsuario` int NOT NULL,
	`nomeArquivo` varchar(255) NOT NULL,
	`urlArquivo` varchar(500) NOT NULL,
	`tipo` varchar(100) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pendente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idLead` int NOT NULL,
	`idUsuario` int NOT NULL,
	`nomeArquivo` varchar(255) NOT NULL,
	`urlArquivo` varchar(500) NOT NULL,
	`tipoArquivo` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idLead` int NOT NULL,
	`idUsuario` int NOT NULL,
	`anotacao` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`email` varchar(320),
	`telefone` varchar(20),
	`origem` varchar(100),
	`interesse` text,
	`observacao` text,
	`status` varchar(50) NOT NULL DEFAULT 'novo',
	`idResponsavel` int,
	`idImovel` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`descricao` text,
	`tipo` varchar(50) NOT NULL,
	`finalidade` varchar(20) NOT NULL,
	`valor` int NOT NULL,
	`valorLocacao` int,
	`area` int,
	`quartos` int,
	`banheiros` int,
	`vagas` int,
	`endereco` varchar(255) NOT NULL,
	`bairro` varchar(100),
	`cidade` varchar(100) NOT NULL,
	`estado` varchar(2) NOT NULL,
	`cep` varchar(10),
	`latitude` varchar(20),
	`longitude` varchar(20),
	`fotos` text,
	`destaque` int NOT NULL DEFAULT 0,
	`status` varchar(20) NOT NULL DEFAULT 'ativo',
	`idCorretor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('cliente','corretor','administrativo') NOT NULL DEFAULT 'cliente';