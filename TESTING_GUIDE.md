# 🧪 Testing Guide - Fresh Database

## 🎯 Current State
- **Database**: Completely cleared
- **Owner User**: `owner@knowledgebase.local` (System Owner)
- **All Tables**: Empty and ready for testing

## 🚀 Testing Flows

### 1. **User Management Flow**
1. **Login as Owner**: Use `owner@knowledgebase.local`
2. **Create Manager**: Go to `/user-builder`
   - Name: "Test Manager"
   - Email: "manager@test.com"
   - Role: "Manager"
3. **Create Employee**: Go to `/user-builder`
   - Name: "Test Employee"
   - Email: "employee@test.com"
   - Role: "Employee"
4. **Verify Users**: Check `/owner?tab=users`

### 2. **Document Management Flow**
1. **Upload Document**: Go to `/docs/import`
2. **View Documents**: Check `/docs`
3. **Test Document Parsing**: Upload a .docx or .pdf file

### 3. **Test Creation Flow**
1. **Create Test**: Go to `/test-builder`
2. **Generate Questions**: Use AI to generate questions
3. **View Tests**: Check `/owner?tab=tests`

### 4. **Assignment Flow**
1. **Create Assignment**: Go to `/assignment-builder`
2. **Assign to Users**: Select users and due dates
3. **View Assignments**: Check `/owner?tab=assignments`

### 5. **Employee Experience Flow**
1. **Login as Employee**: Use `employee@test.com`
2. **View Assignments**: Check `/employee`
3. **Take Test**: Complete assigned tests
4. **View Progress**: Check progress tracking

### 6. **Manager Experience Flow**
1. **Login as Manager**: Use `manager@test.com`
2. **View Dashboard**: Check `/manager`
3. **Manage Team**: View team progress and assignments

## 🔧 Database Tools Available

### Drizzle Studio
```bash
npm run db:studio
```
- URL: https://local.drizzle.studio
- View all tables and data in real-time

### pgAdmin
- URL: http://localhost:8080
- Email: admin@example.com
- Password: admin

## 📊 API Endpoints for Testing

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `DELETE /api/users/[id]` - Delete user

### Documents
- `GET /api/documents` - List documents
- `DELETE /api/documents/[id]` - Delete document

### Tests
- `GET /api/tests` - List tests
- `POST /api/generate-test` - Generate AI questions

### Assignments
- `GET /api/assignments` - List assignments
- `POST /api/assignments/[id]/start` - Start assignment
- `POST /api/assignments/[id]/complete` - Complete assignment

## 🎉 Ready to Test!

The database is now clean with only the owner user. You can test all flows from scratch and see how the application behaves with fresh data.

**Owner Credentials:**
- Email: `owner@knowledgebase.local`
- Role: `owner`
- Name: `System Owner`
