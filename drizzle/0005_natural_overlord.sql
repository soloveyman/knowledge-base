ALTER TABLE "assignments" ADD COLUMN "business_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "business_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "business_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "business_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "business_id" uuid NOT NULL;