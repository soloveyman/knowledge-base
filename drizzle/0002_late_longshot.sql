ALTER TABLE "bookings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "businesses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room_types" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rooms" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tables" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bookings" CASCADE;--> statement-breakpoint
DROP TABLE "business_users" CASCADE;--> statement-breakpoint
DROP TABLE "businesses" CASCADE;--> statement-breakpoint
DROP TABLE "events" CASCADE;--> statement-breakpoint
DROP TABLE "menu_categories" CASCADE;--> statement-breakpoint
DROP TABLE "menu_items" CASCADE;--> statement-breakpoint
DROP TABLE "order_items" CASCADE;--> statement-breakpoint
DROP TABLE "orders" CASCADE;--> statement-breakpoint
DROP TABLE "room_types" CASCADE;--> statement-breakpoint
DROP TABLE "rooms" CASCADE;--> statement-breakpoint
DROP TABLE "tables" CASCADE;--> statement-breakpoint
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "progress" DROP CONSTRAINT "progress_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "tests" DROP CONSTRAINT "tests_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "progress" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "tests" DROP COLUMN "business_id";