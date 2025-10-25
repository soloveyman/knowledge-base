// Script to create sample assignments for testing
// Run this in the browser console or as a one-time setup

const sampleAssignments = [
  {
    id: "1",
    name: "Safety Training Assignment",
    description: "Complete safety guidelines review and test",
    document: {
      id: 4,
      name: "Safety Guidelines.pdf",
      type: "PDF",
      uploadedAt: "1 hour ago"
    },
    test: {
      id: "test-1",
      title: "Safety Guidelines Test",
      questionCount: 5
    },
    assignedUsers: [
      { id: 2, name: "Петр Петров", email: "petr.petrov@company.com", role: "Employee", department: "Kitchen" },
      { id: 3, name: "Мария Сидорова", email: "maria.sidorova@company.com", role: "Employee", department: "Service" }
    ],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    createdAt: new Date().toISOString(),
    createdBy: "Manager",
    status: "active"
  },
  {
    id: "2", 
    name: "Menu Knowledge Training",
    description: "Learn the lunch menu and complete assessment",
    document: {
      id: 1,
      name: "Ланч меню BS.docx",
      type: "DOCX", 
      uploadedAt: "2 hours ago"
    },
    test: {
      id: "test-2",
      title: "Menu Knowledge Test",
      questionCount: 8
    },
    assignedUsers: [
      { id: 2, name: "Петр Петров", email: "petr.petrov@company.com", role: "Employee", department: "Kitchen" },
      { id: 4, name: "Алексей Козлов", email: "alexey.kozlov@company.com", role: "Employee", department: "Kitchen" }
    ],
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    createdAt: new Date().toISOString(),
    createdBy: "Manager", 
    status: "active"
  },
  {
    id: "3",
    name: "Employee Handbook Review",
    description: "Review company policies and procedures",
    document: {
      id: 3,
      name: "Employee Handbook.docx", 
      type: "DOCX",
      uploadedAt: "5 minutes ago"
    },
    test: null, // Document only, no test
    assignedUsers: [
      { id: 5, name: "Елена Морозова", email: "elena.morozova@company.com", role: "Employee", department: "Service" },
      { id: 7, name: "Ольга Новикова", email: "olga.novikova@company.com", role: "Employee", department: "Kitchen" }
    ],
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    createdAt: new Date().toISOString(),
    createdBy: "Manager",
    status: "active"
  }
]

// Save to localStorage
localStorage.setItem('savedAssignments', JSON.stringify(sampleAssignments))

console.log('Sample assignments created successfully!')
console.log('Assignments:', sampleAssignments)
