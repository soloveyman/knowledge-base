// Script to create sample tests for assignments
// Run this in the browser console or as a one-time setup

const sampleTests = [
  {
    id: "test-1",
    title: "Safety Guidelines Test",
    type: "mcq",
    difficulty: "medium",
    locale: "ru",
    questionCount: 5,
    questions: [
      {
        id: "q1",
        type: "mcq",
        prompt: "Что необходимо делать при обнаружении неисправного оборудования?",
        choices: [
          "Продолжить работу с осторожностью",
          "Немедленно прекратить использование и сообщить руководству",
          "Попытаться починить самостоятельно",
          "Использовать только в крайнем случае"
        ],
        correct_answer: "B",
        explanation: "Неисправное оборудование должно быть немедленно выведено из эксплуатации и о проблеме должно быть сообщено руководству."
      },
      {
        id: "q2", 
        type: "mcq",
        prompt: "Какие средства индивидуальной защиты обязательны на кухне?",
        choices: [
          "Только фартук",
          "Фартук, перчатки и не скользящая обувь",
          "Только перчатки",
          "Средства защиты не обязательны"
        ],
        correct_answer: "B",
        explanation: "На кухне обязательно использование фартука, перчаток и не скользящей обуви для обеспечения безопасности."
      },
      {
        id: "q3",
        type: "mcq", 
        prompt: "Что делать при пожаре?",
        choices: [
          "Продолжить работу",
          "Вызвать пожарную службу и эвакуировать людей",
          "Попытаться потушить самостоятельно",
          "Скрыть информацию о пожаре"
        ],
        correct_answer: "B",
        explanation: "При пожаре необходимо немедленно вызвать пожарную службу и эвакуировать всех людей из здания."
      },
      {
        id: "q4",
        type: "mcq",
        prompt: "Как правильно обращаться с ножами?",
        choices: [
          "Осторожно, держа лезвие от себя",
          "Можно держать как удобно",
          "Только в перчатках",
          "Использовать только тупые ножи"
        ],
        correct_answer: "A",
        explanation: "Ножи следует держать осторожно, лезвием от себя, чтобы избежать травм."
      },
      {
        id: "q5",
        type: "mcq",
        prompt: "Что делать при получении травмы?",
        choices: [
          "Продолжить работу",
          "Оказать первую помощь и вызвать скорую",
          "Скрыть травму",
          "Обратиться к коллегам за советом"
        ],
        correct_answer: "B",
        explanation: "При получении травмы необходимо оказать первую помощь и вызвать скорую медицинскую помощь."
      }
    ],
    sourceDocument: "Safety Guidelines.pdf",
    createdAt: new Date().toISOString(),
    createdBy: "Manager"
  },
  {
    id: "test-2",
    title: "Menu Knowledge Test", 
    type: "mcq",
    difficulty: "easy",
    locale: "ru",
    questionCount: 8,
    questions: [
      {
        id: "q1",
        type: "mcq",
        prompt: "Сколько стоит борщ украинский с мясом?",
        choices: ["200₽", "250₽", "280₽", "300₽"],
        correct_answer: "B",
        explanation: "Борщ украинский с мясом стоит 250₽ согласно меню."
      },
      {
        id: "q2",
        type: "mcq", 
        prompt: "Какая цена у котлеты по-киевски?",
        choices: ["400₽", "420₽", "450₽", "480₽"],
        correct_answer: "C",
        explanation: "Котлета по-киевски с картофельным пюре стоит 450₽."
      },
      {
        id: "q3",
        type: "mcq",
        prompt: "Сколько стоит греческий салат?",
        choices: ["140₽", "160₽", "180₽", "200₽"],
        correct_answer: "B", 
        explanation: "Греческий салат стоит 160₽."
      },
      {
        id: "q4",
        type: "mcq",
        prompt: "Какая цена у компота из сухофруктов?",
        choices: ["60₽", "70₽", "80₽", "90₽"],
        correct_answer: "C",
        explanation: "Компот из сухофруктов стоит 80₽."
      },
      {
        id: "q5",
        type: "mcq",
        prompt: "Сколько стоит плов узбекский?",
        choices: ["300₽", "320₽", "350₽", "380₽"],
        correct_answer: "B",
        explanation: "Плов узбекский стоит 320₽."
      },
      {
        id: "q6",
        type: "mcq",
        prompt: "Какая цена у рыбы запеченной с овощами?",
        choices: ["350₽", "380₽", "400₽", "420₽"],
        correct_answer: "B",
        explanation: "Рыба запеченная с овощами стоит 380₽."
      },
      {
        id: "q7",
        type: "mcq",
        prompt: "Сколько стоит морс клюквенный?",
        choices: ["80₽", "85₽", "90₽", "95₽"],
        correct_answer: "C",
        explanation: "Морс клюквенный стоит 90₽."
      },
      {
        id: "q8",
        type: "mcq",
        prompt: "Какая цена у чая/кофе?",
        choices: ["50₽", "60₽", "70₽", "80₽"],
        correct_answer: "B",
        explanation: "Чай/кофе стоит 60₽."
      }
    ],
    sourceDocument: "Ланч меню BS.docx",
    createdAt: new Date().toISOString(),
    createdBy: "Manager"
  }
]

// Save to localStorage
localStorage.setItem('savedTests', JSON.stringify(sampleTests))

console.log('Sample tests created successfully!')
console.log('Tests:', sampleTests)
