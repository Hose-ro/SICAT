# SICAT - Sistema de Control de Asistencias y Tareas

## Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: NestJS
- **ORM**: Prisma
- **Base de datos**: PostgreSQL

## Estructura
```
SICAT/
├── frontend/   # React + Vite + Tailwind
└── backend/    # NestJS + Prisma
```

## Inicio rápido

### Backend
```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Swagger docs: http://localhost:3000/api/docs
