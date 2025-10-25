# HORECA SaaS Platform

A comprehensive SaaS solution for the HORECA industry (Hotels, Restaurants, and Catering) built with Next.js 16, TypeScript, and modern web technologies.

## 🚀 Features

- **Restaurant Management**: Complete POS and inventory management
- **Hotel Services**: Booking and guest management system
- **Catering Solutions**: Event planning and order management
- **Real-time Analytics**: Business insights and reporting
- **Multi-tenant Architecture**: Support for multiple businesses
- **Mobile Responsive**: Works on all devices

## 🛠️ Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database**: Vercel Postgres with Drizzle ORM
- **Authentication**: Auth.js (NextAuth.js v5)
- **Validation**: Zod
- **Caching**: Vercel KV
- **Deployment**: Vercel

## 🏃‍♂️ Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker and Docker Compose (for local development)
- Vercel account (for production deployment)

### Local Development Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd knowledge-base
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

4. Configure your environment variables in `.env.local`:
```env
# Database (local Docker setup)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional: OAuth providers
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
```

5. Start the local database with Docker:
```bash
npm run docker:up
```

6. Set up the database schema:
```bash
npm run db:push
```

7. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Docker Commands

- `npm run docker:up` - Start the database containers
- `npm run docker:down` - Stop the database containers
- `npm run docker:logs` - View container logs
- `npm run docker:reset` - Reset database (removes all data)
- `npm run db:setup` - Start database and push schema

### Database Management

- **pgAdmin**: Available at [http://localhost:8080](http://localhost:8080)
  - Email: `admin@knowledgebase.local`
  - Password: `admin`
- **Drizzle Studio**: Run `npm run db:studio` to open the database GUI

## 📁 Project Structure

```
horeca-saas/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable components
│   └── ui/               # shadcn/ui components
├── lib/                  # Utility functions
├── public/               # Static assets
└── ...config files
```

## 🗄️ Database

This project uses Drizzle ORM with PostgreSQL. For local development, we use Docker to run PostgreSQL, while production uses Vercel Postgres.

### Database Scripts

- `npm run db:generate` - Generate migration files
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio (database GUI)
- `npm run db:setup` - Start Docker database and push schema

### Local Database Features

- **PostgreSQL 15** with Alpine Linux for minimal footprint
- **pgAdmin** web interface for database management
- **Health checks** to ensure database is ready before app starts
- **Persistent volumes** to preserve data between container restarts
- **UUID extensions** and other useful PostgreSQL extensions

## 🚀 Deployment

Deploy to Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
