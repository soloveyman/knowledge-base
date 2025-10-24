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
- Vercel account (for database and deployment)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd horeca-saas
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local`:
```env
# Database
DATABASE_URL="postgresql://..."
POSTGRES_URL="postgresql://..."

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Vercel KV
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
```

5. Run database migrations:
```bash
npm run db:migrate
```

6. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

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

This project uses Drizzle ORM with Vercel Postgres. Database schema and migrations are managed through Drizzle Kit.

### Available Scripts

- `npm run db:generate` - Generate migration files
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Drizzle Studio

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
