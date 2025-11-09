# Docker Database Setup for Local Development

This guide explains how to use Docker for local database development.

## Quick Start

1. **Set up Docker database configuration:**
   ```bash
   npm run db:setup:docker
   ```
   This will:
   - Create/update `.env.local` with Docker database URL
   - Start the PostgreSQL container
   - Push the database schema

2. **Or manually:**
   ```bash
   # Start Docker containers
   npm run docker:up
   
   # Push database schema
   npm run db:push
   ```

## Docker Services

### PostgreSQL Database
- **Container**: `knowledge-base-db`
- **Port**: `5432`
- **Database**: `knowledge_base`
- **User**: `postgres`
- **Password**: `postgres`
- **Connection String**: `postgresql://postgres:postgres@localhost:5432/knowledge_base`

### pgAdmin (Optional)
- **Container**: `knowledge-base-pgadmin`
- **Port**: `8080`
- **URL**: http://localhost:8080
- **Email**: `admin@example.com`
- **Password**: `admin`

## Available Commands

### Docker Management
- `npm run docker:up` - Start database containers
- `npm run docker:down` - Stop database containers
- `npm run docker:logs` - View container logs
- `npm run docker:reset` - Reset database (removes all data)

### Database Setup
- `npm run db:setup` - Start database and push schema
- `npm run db:setup:docker` - Full setup (config + start + push)
- `npm run db:push` - Push schema to database
- `npm run db:generate` - Generate migration files
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Drizzle Studio

## Environment Configuration

The Docker setup uses the following environment variables in `.env.local`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base"
```

**Note**: SSL is automatically disabled for local Docker connections (localhost).

## Database Management Tools

### Drizzle Studio
```bash
npm run db:studio
```
Opens a web-based database GUI at http://localhost:4983

### pgAdmin
Access at http://localhost:8080 after starting containers.

To connect to the database in pgAdmin:
- **Host**: `postgres` (container name)
- **Port**: `5432`
- **Database**: `knowledge_base`
- **Username**: `postgres`
- **Password**: `postgres`

## Troubleshooting

### Container won't start
```bash
# Check logs
npm run docker:logs

# Reset containers
npm run docker:reset
```

### Connection refused
1. Verify container is running: `docker ps`
2. Check if port 5432 is available: `netstat -an | grep 5432`
3. Verify DATABASE_URL in `.env.local`

### Database schema issues
```bash
# Reset and re-push schema
npm run docker:reset
npm run db:push
```

### Port already in use
If port 5432 is already in use, you can change it in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"  # Use 5433 instead
```
Then update DATABASE_URL: `postgresql://postgres:postgres@localhost:5433/knowledge_base`

## Data Persistence

Database data is persisted in a Docker volume (`postgres_data`). To completely reset:
```bash
npm run docker:reset  # Removes volumes and recreates containers
```

## Production vs Development

- **Development (Docker)**: No SSL, localhost connection
- **Production (Railway)**: SSL enabled, remote connection

The database connection automatically detects the environment and configures SSL accordingly.

