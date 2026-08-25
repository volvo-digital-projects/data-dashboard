CREATE TABLE `dashboard_login_visitors` (
	`visitor_hash` text PRIMARY KEY NOT NULL,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
