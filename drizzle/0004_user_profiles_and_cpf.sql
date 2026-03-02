ALTER TABLE `users` ADD `cpf` varchar(14);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);
--> statement-breakpoint
ALTER TABLE `users` ADD `birthDate` date;
--> statement-breakpoint
ALTER TABLE `users` ADD `profession` varchar(120);
--> statement-breakpoint
ALTER TABLE `users` ADD `grossMonthlyIncome` int;
--> statement-breakpoint
ALTER TABLE `users` ADD `maritalStatus` varchar(40);
--> statement-breakpoint
ALTER TABLE `users` ADD `householdIncome` int;
--> statement-breakpoint
ALTER TABLE `users` ADD `rg` varchar(32);
--> statement-breakpoint
ALTER TABLE `users` ADD `nationality` varchar(80);
--> statement-breakpoint
ALTER TABLE `users` ADD `address` varchar(255);
--> statement-breakpoint
ALTER TABLE `users` ADD `city` varchar(100);
--> statement-breakpoint
ALTER TABLE `users` ADD `state` varchar(2);
--> statement-breakpoint
ALTER TABLE `users` ADD `zipCode` varchar(10);
--> statement-breakpoint
ALTER TABLE `users` ADD `notes` text;
--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_cpf_unique` UNIQUE(`cpf`);
