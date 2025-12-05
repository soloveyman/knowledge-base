# Анализ проверки тестов сотрудников

## Текущая реализация

### 1. Процесс проверки тестов

#### Клиентская сторона (`app/test/[testId]/page.tsx`)

**Функция `handleSubmitTest`** (строки 200-461):
- Проверка ответов происходит **полностью на клиенте** (в браузере)
- Поддерживаемые типы вопросов:
  - `text` / `complete` - текстовые ответы (нормализация регистра и пробелов)
  - `mcq` - одиночный выбор (A, B, C, D или индексы 1-4)
  - `mcq_multi` - множественный выбор
  - `tf` / `true_false` - правда/ложь (поддержка EN/RU)

**Логика подсчета баллов:**
```typescript
// Строки 412-416
const percentage = totalQuestionsWithAnswers > 0 
  ? Math.round((correctAnswers / totalQuestionsWithAnswers) * 100)
  : 0
```

**Особенности:**
- Вопросы без `correct_answer` **исключаются** из подсчета
- Неотвеченные вопросы считаются неправильными
- Результат отправляется на сервер с уже рассчитанным `score`

#### Серверная сторона (`app/api/test-attempts/route.ts`)

**POST endpoint** (строки 8-92):
- **Принимает готовый `score` от клиента** без перепроверки
- Валидация только через Zod схему: `score: z.number().int().min(0).max(100)`
- Сохраняет результат в таблицу `testAttempts`
- Обновляет статус назначения на основе лучшего результата:

```typescript
// Строки 64-65
const assignmentStatus = bestScore >= 70 ? 'completed' : 'failed'
```

**Проблема:** Проходной балл **жестко закодирован как 70%**, хотя в схеме БД у теста есть поле `passingScore`.

### 2. Отображение результатов

#### Страница сотрудника (`app/employee/page.tsx`)

**Трансформация назначений** (строки 371-411):
```typescript
// Строки 380-386
if (testScore !== undefined && testScore !== null) {
  if (testScore < 70) {
    userStatus = 'failed'
  } else if (testScore >= 70 && userStatus === 'completed') {
    userStatus = 'completed'
  }
}
```

**Проблема:** Снова жестко закодирован порог 70%.

#### API назначений (`app/api/assignments/route.ts`)

**Получение лучшего результата** (строки 81-107):
- Группирует попытки по `testId:userId`
- Выбирает попытку с **наивысшим баллом**
- При равных баллах выбирает **самую свежую**

## Выявленные проблемы

### 🔴 Критичные

1. **Отсутствие серверной валидации ответов**
   - Клиент может отправить любой `score` (0-100)
   - Сервер не перепроверяет ответы
   - **Уязвимость безопасности**: можно подделать результат

2. **Жестко закодированный проходной балл**
   - Везде используется `70%` вместо `test.passingScore`
   - Нельзя настроить индивидуальный порог для каждого теста

### ⚠️ Средние

3. **Нет проверки времени выполнения**
   - `timeSpent` отправляется с клиента
   - Не проверяется соответствие `timeLimit` теста

4. **Нет проверки количества попыток**
   - `maxAttempts` не проверяется на сервере при сохранении
   - Можно превысить лимит попыток

5. **Нет валидации структуры ответов**
   - Не проверяется соответствие типов вопросов и ответов
   - Можно отправить невалидные данные

## Рекомендации по улучшению

### 1. Добавить серверную валидацию ответов

**Создать функцию проверки на сервере:**

```typescript
// lib/test-validation.ts
export async function validateTestAnswers(
  testId: string,
  userAnswers: Record<string, unknown>
): Promise<{ score: number; correctAnswers: number; totalQuestions: number }> {
  // Загрузить тест с вопросами из БД
  // Перепроверить все ответы
  // Вернуть реальный результат
}
```

**Использовать в API:**

```typescript
// app/api/test-attempts/route.ts
const validationResult = await validateTestAnswers(testId, answers)
const finalScore = validationResult.score // Использовать серверный результат
```

### 2. Использовать `test.passingScore` вместо жестко закодированного значения

**В API:**

```typescript
// Загрузить тест
const test = await db.select().from(tests).where(eq(tests.id, testId))
const passingScore = test[0]?.passingScore ?? 70

const assignmentStatus = bestScore >= passingScore ? 'completed' : 'failed'
```

**В компонентах:**

```typescript
// Передавать passingScore из теста в компоненты
// Использовать его вместо константы 70
```

### 3. Добавить проверку лимитов

```typescript
// Проверить maxAttempts
const existingAttempts = await db.select()
  .from(testAttempts)
  .where(and(
    eq(testAttempts.testId, testId),
    eq(testAttempts.userId, userId)
  ))

if (existingAttempts.length >= test.maxAttempts) {
  return NextResponse.json(
    { success: false, message: 'Maximum attempts exceeded' },
    { status: 403 }
  )
}
```

### 4. Валидация времени выполнения

```typescript
// Проверить timeLimit
if (test.timeLimit && timeSpent > test.timeLimit * 60) {
  // Логировать подозрительную активность
  // Возможно, отклонить результат
}
```

## Текущий поток данных

```
1. Сотрудник проходит тест
   ↓
2. Клиент проверяет ответы (handleSubmitTest)
   ↓
3. Клиент рассчитывает score
   ↓
4. POST /api/test-attempts { testId, answers, score }
   ↓
5. Сервер сохраняет score БЕЗ перепроверки
   ↓
6. Сервер обновляет статус назначения (score >= 70)
   ↓
7. Сотрудник видит результат на /employee
```

## Рекомендуемый поток данных

```
1. Сотрудник проходит тест
   ↓
2. POST /api/test-attempts { testId, answers }
   ↓
3. Сервер загружает тест и вопросы
   ↓
4. Сервер перепроверяет ВСЕ ответы
   ↓
5. Сервер рассчитывает score
   ↓
6. Сервер проверяет лимиты (maxAttempts, timeLimit)
   ↓
7. Сервер использует test.passingScore для определения статуса
   ↓
8. Сервер сохраняет результат
   ↓
9. Сотрудник видит результат
```

## Файлы для изменения

1. **`app/api/test-attempts/route.ts`** - добавить серверную валидацию
2. **`lib/test-validation.ts`** - создать новый файл с логикой проверки
3. **`app/employee/page.tsx`** - использовать `test.passingScore`
4. **`app/api/assignments/route.ts`** - использовать `test.passingScore`
5. **`app/test/[testId]/page.tsx`** - убрать расчет score, отправлять только answers

## Приоритеты исправления

1. **Высокий**: Добавить серверную валидацию ответов
2. **Высокий**: Использовать `test.passingScore` вместо константы
3. **Средний**: Проверка `maxAttempts` на сервере
4. **Низкий**: Валидация времени выполнения

