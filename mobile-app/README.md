# School App – React Native (Expo)

Mobile app for students and teachers. Admin uses the web portal only.

## Setup

```bash
cd mobile-app
npm install
npx expo start
```

## Structure

```
app/
├── _layout.tsx           # Root layout
├── index.tsx             # Role selection (Student / Teacher)
├── (auth)/
│   ├── student-login.tsx # Student login form (Student ID + password)
│   └── teacher-login.tsx # Teacher login form (email + password)
└── (app)/
    ├── student-dashboard.tsx  # Student dashboard
    └── teacher-dashboard.tsx  # Teacher dashboard
```

## Screens

### Role Selection (`/`)
- Tap **Student** → student login
- Tap **Teacher** → teacher login

### Student Login
- Fields: Student ID + Password
- Blue theme 🎓

### Teacher Login
- Fields: Email + Password
- Purple theme 📚

### Student Dashboard
- Attendance summary (present/absent/late)
- Grades per subject
- Today's schedule
- Announcements

### Teacher Dashboard
- Pending tasks (ungraded, attendance, messages)
- Today's classes with student counts
- Quick actions (attendance, grades, announcements, messages)
- Students needing follow-up

## Connecting to Laravel backend

Replace the `await new Promise(...)` mock in login screens with a real `fetch` call:

```ts
const res = await fetch('https://yourschool.edu/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, role: 'student' }),
});
const data = await res.json();
if (data.token) {
  // store token, then navigate to dashboard
}
```

Admin access is restricted to the web portal at `https://yourschool.edu`.
