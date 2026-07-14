CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`parent_account_id` text,
	`name` text NOT NULL,
	`company_name` text,
	`trading_name` text,
	`email` text NOT NULL,
	`login_email` text,
	`cpf_cnpj` text NOT NULL,
	`person_type` text NOT NULL,
	`company_type` text,
	`birth_date` text,
	`mobile_phone` text,
	`phone` text,
	`site` text,
	`address` text,
	`address_number` text,
	`complement` text,
	`province` text,
	`postal_code` text,
	`city` text,
	`state` text,
	`country` text NOT NULL,
	`income_cents` integer,
	`status` text NOT NULL,
	`balance_cents` integer NOT NULL,
	`account_number` text,
	`date_created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_wallet_id_uq` ON `accounts` (`wallet_id`);--> statement-breakpoint
CREATE INDEX `accounts_parent_idx` ON `accounts` (`parent_account_id`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`active` integer NOT NULL,
	`date_created` text NOT NULL,
	`expiration_date` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_uq` ON `api_keys` (`key`);--> statement-breakpoint
CREATE INDEX `api_keys_account_idx` ON `api_keys` (`account_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`cpf_cnpj` text NOT NULL,
	`person_type` text NOT NULL,
	`email` text,
	`phone` text,
	`mobile_phone` text,
	`address` text,
	`address_number` text,
	`complement` text,
	`province` text,
	`postal_code` text,
	`city` text,
	`city_name` text,
	`state` text,
	`country` text,
	`external_reference` text,
	`notification_disabled` integer NOT NULL,
	`additional_emails` text,
	`municipal_inscription` text,
	`state_inscription` text,
	`observations` text,
	`group_name` text,
	`company` text,
	`foreign_customer` integer,
	`deleted` integer NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `customers_account_idx` ON `customers` (`account_id`,`deleted`);--> statement-breakpoint
CREATE INDEX `customers_cpf_idx` ON `customers` (`account_id`,`cpf_cnpj`);--> statement-breakpoint
CREATE INDEX `customers_external_ref_idx` ON `customers` (`account_id`,`external_reference`);--> statement-breakpoint
CREATE TABLE `credit_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`customer_id` text,
	`credit_card_token` text NOT NULL,
	`last4` text NOT NULL,
	`brand` text NOT NULL,
	`holder_name` text NOT NULL,
	`expiry_month` text NOT NULL,
	`expiry_year` text NOT NULL,
	`simulated_outcome` text NOT NULL,
	`holder_info` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `credit_cards_token_idx` ON `credit_cards` (`credit_card_token`);--> statement-breakpoint
CREATE INDEX `credit_cards_account_idx` ON `credit_cards` (`account_id`);--> statement-breakpoint
CREATE TABLE `payment_refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`status` text NOT NULL,
	`value_cents` integer NOT NULL,
	`description` text,
	`refunded_fee_cents` integer NOT NULL,
	`effective_date` text,
	`transaction_receipt_url` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_refunds_payment_idx` ON `payment_refunds` (`payment_id`);--> statement-breakpoint
CREATE TABLE `payment_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`wallet_id` text NOT NULL,
	`recipient_account_id` text,
	`fixed_value_cents` integer,
	`percentual_value_e4` integer,
	`total_fixed_value_cents` integer,
	`total_value_cents` integer,
	`status` text NOT NULL,
	`cancellation_reason` text,
	`refusal_reason` text,
	`blocked_until` text,
	`credit_date` text,
	`external_reference` text,
	`description` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_splits_payment_idx` ON `payment_splits` (`payment_id`);--> statement-breakpoint
CREATE INDEX `payment_splits_status_idx` ON `payment_splits` (`status`,`blocked_until`);--> statement-breakpoint
CREATE INDEX `payment_splits_wallet_idx` ON `payment_splits` (`wallet_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`subscription_id` text,
	`installment_id` text,
	`installment_number` text,
	`payment_link_id` text,
	`checkout_session` text,
	`billing_type` text NOT NULL,
	`status` text NOT NULL,
	`value_cents` integer NOT NULL,
	`net_value_cents` integer NOT NULL,
	`original_value_cents` integer,
	`interest_value_cents` integer,
	`fee_cents` integer NOT NULL,
	`description` text,
	`external_reference` text,
	`due_date` text NOT NULL,
	`original_due_date` text NOT NULL,
	`payment_date` text,
	`client_payment_date` text,
	`confirmed_date` text,
	`credit_date` text,
	`estimated_credit_date` text,
	`discount` text,
	`fine` text,
	`interest` text,
	`callback` text,
	`credit_card_id` text,
	`pix_qr_code_id` text,
	`pix_transaction_id` text,
	`invoice_url` text,
	`bank_slip_url` text,
	`transaction_receipt_url` text,
	`invoice_number` text,
	`nosso_numero` text,
	`days_after_due_date_to_registration_cancellation` integer,
	`postal_service` integer NOT NULL,
	`can_be_paid_after_due_date` integer NOT NULL,
	`anticipated` integer NOT NULL,
	`anticipable` integer NOT NULL,
	`deleted` integer NOT NULL,
	`last_invoice_viewed_date` text,
	`last_bank_slip_viewed_date` text,
	`date_created` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_overdue_idx` ON `payments` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `payments_credit_idx` ON `payments` (`status`,`credit_date`);--> statement-breakpoint
CREATE INDEX `payments_account_idx` ON `payments` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `payments_customer_idx` ON `payments` (`account_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `payments_subscription_idx` ON `payments` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `payments_installment_idx` ON `payments` (`installment_id`);--> statement-breakpoint
CREATE INDEX `payments_external_ref_idx` ON `payments` (`account_id`,`external_reference`);--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`billing_type` text NOT NULL,
	`installment_count` integer NOT NULL,
	`installment_value_cents` integer NOT NULL,
	`total_value_cents` integer NOT NULL,
	`net_value_cents` integer NOT NULL,
	`expiration_day` integer NOT NULL,
	`description` text,
	`payment_link_id` text,
	`checkout_session` text,
	`transaction_receipt_url` text,
	`deleted` integer NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `installments_account_idx` ON `installments` (`account_id`,`deleted`);--> statement-breakpoint
CREATE TABLE `subscription_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`wallet_id` text NOT NULL,
	`fixed_value_cents` integer,
	`percentual_value_e4` integer,
	`status` text NOT NULL,
	`disabled_reason` text,
	`external_reference` text,
	`description` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscription_splits_sub_idx` ON `subscription_splits` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`billing_type` text NOT NULL,
	`cycle` text NOT NULL,
	`status` text NOT NULL,
	`value_cents` integer NOT NULL,
	`next_due_date` text NOT NULL,
	`end_date` text,
	`max_payments` integer,
	`payments_generated` integer NOT NULL,
	`description` text,
	`external_reference` text,
	`payment_link_id` text,
	`checkout_session` text,
	`credit_card_id` text,
	`discount` text,
	`fine` text,
	`interest` text,
	`deleted` integer NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscriptions_generation_idx` ON `subscriptions` (`status`,`next_due_date`);--> statement-breakpoint
CREATE INDEX `subscriptions_account_idx` ON `subscriptions` (`account_id`,`deleted`);--> statement-breakpoint
CREATE TABLE `subscription_invoice_configs` (
	`subscription_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`municipal_service_id` text,
	`municipal_service_code` text,
	`municipal_service_name` text,
	`deductions_cents` integer,
	`invoice_creation_period` text,
	`days_before_due_date` integer,
	`received_only` integer,
	`update_payment` integer,
	`observations` text,
	`taxes` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`event_id` text NOT NULL,
	`account_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`status` text NOT NULL,
	`attempt` integer NOT NULL,
	`next_attempt_at_ms` integer,
	`last_attempt_at` text,
	`last_status_code` integer,
	`last_error` text,
	`expires_at_ms` integer NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `webhook_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_due_idx` ON `webhook_deliveries` (`webhook_id`,`status`,`next_attempt_at_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_deliveries_seq_uq` ON `webhook_deliveries` (`webhook_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_event_idx` ON `webhook_deliveries` (`event_id`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`event` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`payload` text NOT NULL,
	`date_created` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhook_events_account_idx` ON `webhook_events` (`account_id`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`email` text NOT NULL,
	`enabled` integer NOT NULL,
	`interrupted` integer NOT NULL,
	`auth_token` text,
	`api_version` integer NOT NULL,
	`send_type` text NOT NULL,
	`events` text NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhooks_account_idx` ON `webhooks` (`account_id`);--> statement-breakpoint
CREATE TABLE `anticipations` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`payment_id` text,
	`installment_id` text,
	`status` text NOT NULL,
	`total_value_cents` integer NOT NULL,
	`value_cents` integer NOT NULL,
	`fee_cents` integer NOT NULL,
	`net_value_cents` integer NOT NULL,
	`anticipation_days` integer NOT NULL,
	`request_date` text NOT NULL,
	`anticipation_date` text,
	`due_date` text,
	`denial_observation` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `anticipations_account_idx` ON `anticipations` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `anticipations_payment_idx` ON `anticipations` (`payment_id`);--> statement-breakpoint
CREATE INDEX `anticipations_settle_idx` ON `anticipations` (`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`value_cents` integer NOT NULL,
	`balance_cents` integer NOT NULL,
	`description` text,
	`date` text NOT NULL,
	`payment_id` text,
	`split_id` text,
	`transfer_id` text,
	`anticipation_id` text,
	`bill_id` text,
	`invoice_id` text,
	`payment_dunning_id` text,
	`credit_bureau_report_id` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `financial_transactions_account_idx` ON `financial_transactions` (`account_id`,`seq`);--> statement-breakpoint
CREATE INDEX `financial_transactions_payment_idx` ON `financial_transactions` (`payment_id`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`operation_type` text,
	`status` text NOT NULL,
	`value_cents` integer NOT NULL,
	`net_value_cents` integer NOT NULL,
	`transfer_fee_cents` integer NOT NULL,
	`destination_wallet_id` text,
	`destination_account_id` text,
	`bank_account` text,
	`pix_address_key` text,
	`pix_address_key_type` text,
	`end_to_end_identifier` text,
	`description` text,
	`external_reference` text,
	`schedule_date` text,
	`effective_date` text,
	`fail_reason` text,
	`authorized` integer NOT NULL,
	`transaction_receipt_url` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transfers_account_idx` ON `transfers` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `transfers_schedule_idx` ON `transfers` (`status`,`schedule_date`);--> statement-breakpoint
CREATE TABLE `pix_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`key` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`qr_code_payload` text,
	`qr_code_encoded_image` text,
	`can_be_deleted` integer NOT NULL,
	`cannot_be_deleted_reason` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pix_keys_account_idx` ON `pix_keys` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `pix_qr_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`payment_id` text,
	`pix_key_id` text,
	`payload` text NOT NULL,
	`encoded_image` text NOT NULL,
	`value_cents` integer,
	`description` text,
	`external_reference` text,
	`allows_multiple_payments` integer NOT NULL,
	`expiration_date` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pix_qr_codes_account_idx` ON `pix_qr_codes` (`account_id`);--> statement-breakpoint
CREATE INDEX `pix_qr_codes_payment_idx` ON `pix_qr_codes` (`payment_id`);--> statement-breakpoint
CREATE TABLE `pix_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`payment_id` text,
	`qr_code_id` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`value_cents` integer NOT NULL,
	`end_to_end_identifier` text,
	`description` text,
	`scheduled_date` text,
	`effective_date` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pix_transactions_account_idx` ON `pix_transactions` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `account_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`title` text,
	`description` text,
	`file_json` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_documents_account_idx` ON `account_documents` (`account_id`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`status` text NOT NULL,
	`value_cents` integer NOT NULL,
	`fee_cents` integer NOT NULL,
	`identification_field` text,
	`bar_code` text,
	`due_date` text,
	`schedule_date` text,
	`payment_date` text,
	`description` text,
	`fail_reasons` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bills_account_idx` ON `bills` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `chargebacks` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`payment_id` text NOT NULL,
	`installment_id` text,
	`customer_account` text,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`dispute_status` text,
	`value_cents` integer NOT NULL,
	`payment_date` text,
	`dispute_start_date` text,
	`deadline_to_send_dispute_documents` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chargebacks_payment_idx` ON `chargebacks` (`payment_id`);--> statement-breakpoint
CREATE TABLE `checkouts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`status` text NOT NULL,
	`value_cents` integer,
	`link` text NOT NULL,
	`expiration_date` text,
	`payload` text NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `checkouts_account_idx` ON `checkouts` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `credit_bureau_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`customer_id` text,
	`cpf_cnpj` text,
	`state` text,
	`status` text NOT NULL,
	`fee_cents` integer NOT NULL,
	`report_file` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `credit_bureau_reports_account_idx` ON `credit_bureau_reports` (`account_id`);--> statement-breakpoint
CREATE TABLE `fiscal_info` (
	`account_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`payment_id` text,
	`installment_id` text,
	`customer_id` text,
	`status` text NOT NULL,
	`value_cents` integer NOT NULL,
	`deductions_cents` integer,
	`service_description` text,
	`observations` text,
	`effective_date` text,
	`number` text,
	`taxes` text,
	`pdf_url` text,
	`xml_url` text,
	`rps_serie` text,
	`rps_number` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoices_account_idx` ON `invoices` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `invoices_payment_idx` ON `invoices` (`payment_id`);--> statement-breakpoint
CREATE TABLE `mobile_phone_recharges` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`status` text NOT NULL,
	`phone_number` text NOT NULL,
	`value_cents` integer NOT NULL,
	`operator_name` text,
	`can_be_cancelled` integer NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mobile_phone_recharges_account_idx` ON `mobile_phone_recharges` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`event` text NOT NULL,
	`enabled` integer NOT NULL,
	`email_enabled_for_provider` integer NOT NULL,
	`sms_enabled_for_provider` integer NOT NULL,
	`email_enabled_for_customer` integer NOT NULL,
	`sms_enabled_for_customer` integer NOT NULL,
	`phone_call_enabled_for_customer` integer NOT NULL,
	`whatsapp_enabled_for_customer` integer NOT NULL,
	`schedule_offset` integer NOT NULL,
	`deleted` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_customer_idx` ON `notifications` (`customer_id`);--> statement-breakpoint
CREATE TABLE `payment_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`available_after_payment` integer NOT NULL,
	`file_json` text,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_documents_payment_idx` ON `payment_documents` (`payment_id`);--> statement-breakpoint
CREATE TABLE `payment_dunnings` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`payment_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`value_cents` integer NOT NULL,
	`net_value_cents` integer NOT NULL,
	`fee_cents` integer NOT NULL,
	`description` text,
	`request_date` text NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_dunnings_account_idx` ON `payment_dunnings` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `payment_links` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`billing_type` text NOT NULL,
	`charge_type` text NOT NULL,
	`value_cents` integer,
	`end_date` text,
	`due_date_limit_days` integer,
	`subscription_cycle` text,
	`max_installment_count` integer,
	`notification_enabled` integer NOT NULL,
	`is_address_required` integer NOT NULL,
	`external_reference` text,
	`callback` text,
	`url` text NOT NULL,
	`active` integer NOT NULL,
	`deleted` integer NOT NULL,
	`view_count` integer NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_links_account_idx` ON `payment_links` (`account_id`,`deleted`);--> statement-breakpoint
CREATE INDEX `payment_links_external_ref_idx` ON `payment_links` (`account_id`,`external_reference`);--> statement-breakpoint
CREATE TABLE `payment_link_images` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_link_id` text NOT NULL,
	`main` integer NOT NULL,
	`original_name` text NOT NULL,
	`size` integer NOT NULL,
	`extension` text NOT NULL,
	`public_token` text NOT NULL,
	`date_created` text NOT NULL,
	FOREIGN KEY (`payment_link_id`) REFERENCES `payment_links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_link_images_link_idx` ON `payment_link_images` (`payment_link_id`);--> statement-breakpoint
CREATE TABLE `account_checkout_configs` (
	`account_id` text PRIMARY KEY NOT NULL,
	`logo_background_color` text,
	`info_background_color` text,
	`font_color` text,
	`enabled` integer NOT NULL,
	`logo_url` text,
	`status` text NOT NULL,
	`observations` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `account_disablements` (
	`account_id` text PRIMARY KEY NOT NULL,
	`remove_reason` text,
	`disabled_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clock_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`virtual_epoch_ms` integer,
	`anchor_real_epoch_ms` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`job_name` text NOT NULL,
	`tick_key` text NOT NULL,
	`ran_at` text NOT NULL,
	PRIMARY KEY(`job_name`, `tick_key`)
);
--> statement-breakpoint
CREATE TABLE `sequences` (
	`name` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
