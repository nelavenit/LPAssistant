# LPAssistant

LPAssistant is an open-ended umbrella project for interactive linear-programming learning tools. It is designed to contain multiple focused applications. Its first and currently only application is **Simplex Assistant**, a modern manual simplex-tableau trainer inspired by the LPAssistant app that accompanied Paul R. Thie and G. E. Keough's *An Introduction to Linear Programming and Game Theory*.

**Live application:** [Simplex Assistant](https://pivotlab-simplex.valbor2002.chatgpt.site)

## Simplex Assistant 0.10.0

Enter the problem as a simplex tableau with equality constraints and nonnegative variables. For a feasible starting basis, assign its unit columns and canonicalize the objective in **Edit**. If a feasible basis is missing, open **Auto-solve → Set up Phase I** and select the rows that need artificial variables. Choose **Solve tableau** or **Start Phase I and solve** to reach the final tableau. The step controls let you review each pivot and phase transition. **Pivot** mode still lets you choose any nonzero pivot manually.

### Features

- arbitrary numbers of constraint rows and variable columns;
- direct editing of the initial tableau's coefficients, RHS values, variable names, variable types, and basis, with spreadsheet-style arrow-key navigation;
- unrestricted-variable splitting with distinct positive and negative parts;
- exact arbitrary-precision rational arithmetic;
- automatic primal simplex with Bland's rule, Phase I completion, and a record of every pivot;
- integer, decimal, scientific-notation, and rational-fraction input;
- exact fraction or configurable decimal display;
- optional primal RHS / a<sub>i,j</sub> and dual c<sub>j</sub> / a<sub>i,j</sub> pivot guidance, disabled by default;
- Phase I with artificial variables z<sub>i</sub> and a canonical `−w` objective row;
- automatic restoration and canonicalization of the original objective after Phase I;
- a Simplex Method Tableau with separate Initial problem, Phase I, and Phase II groups when artificial variables change its columns;
- marked pivots plus undo and redo for tableau editing and pivot steps;
- project save/open, local autosave, and locally stored previous-problem history;
- a curated example library covering Phase I, cycling, pivot-rule comparisons, primal/dual size tradeoffs, degeneracy, alternate optima, unboundedness, and infeasibility;
- LaTeX, Markdown, CSV, PDF, PNG, transparent PNG, and SVG export for either the initial problem or the complete solution;
- English and Russian interfaces with automatic browser language selection, remappable keyboard shortcuts, and light/dark themes;
- a touch layout with horizontal table scrolling and a separate confirmation for each pivot;
- installable, offline-ready PWA behavior.

## Mathematical convention

The constraint rows and the objective row are treated uniformly as tableau equations. At a chosen nonzero entry a<sub>i,j</sub> in row i and column j, Simplex Assistant divides row i by a<sub>i,j</sub>, eliminates column j from every other constraint row and from the objective row, and assigns the entering variable to row i's basis position.

All stored numbers are reduced pairs of arbitrary-precision integers. Decimal formatting never changes the stored value.

Use the objective equation `−f + cᵀx = b₀` for a minimization problem. The current objective value is `−b₀` when the basis is canonical. To maximize `g`, minimize `f = −g` and reverse the sign of the resulting optimum when interpreting it. The result panel checks the basis, feasibility and reduced costs using exact arithmetic.

## Development

Prerequisite: Node.js `>=22.13.0`.

```bash
npm ci
npm run dev:pages
```

Useful checks:

```bash
npm run build:pages
npm run test:pages
npm run preview:pages
```

## GitHub Pages

In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Push the changes to `main` or run **GitHub Pages** manually from the Actions tab after the workflow is on `main`. The workflow tests the static build and uploads only `dist/pages`. The project URL is [nelavenit.github.io/LPAssistant/](https://nelavenit.github.io/LPAssistant/) once configured and deployed.

The local production preview uses `/LPAssistant/` by default. The workflow takes the base path from GitHub Pages. For another host, set `PAGES_BASE_PATH` at build and preview, using a leading and trailing slash. The original Sites build remains available via `npm run build`.

The Pages build targets Safari on iOS 16.4 or later and Chrome on Android 111 or later. On iPhone, Safari can add the app from **Share → Add to Home Screen**. The production service worker downloads the assets for offline use on the first online visit.

## На занятии

1. Откройте **Новая → Создать таблицу**. Перенесите модель в таблицу: приведите ограничения к равенствам с неотрицательными переменными. Введите коэффициенты целевой функции в соглашении `−f + cᵀx = b₀`. Поддерживаются, например, `−3/7`, `1,25` и `1e−3`.
2. В режиме **Правка** назначьте базис по единичным столбцам и приведите строку цели к базису. Если нужен искусственный базис, выберите **Подготовить фазу I** и отметьте нужные строки. Когда сумма искусственных переменных станет нулевой, завершите фазу I, чтобы вернуться к исходной целевой функции.
3. В режиме **Поворот** выбирайте разрешающие элементы вручную. Горизонтальная прокрутка открывает остальные столбцы, а стрелки в панели управления переключают шаги. В **Текущем результате** или **Оптимальном решении** можно проверить допустимость базиса и прочитать значения переменных.

Для автоматического решения откройте **Авторешение → Решить задачу** после подготовки канонической таблицы. Если нужен искусственный базис, выберите **Авторешение → Подготовить фазу I**, отметьте нужные строки и нажмите **Начать фазу I и решить**. Приложение покажет итоговую таблицу. Стрелки в панели управления позволяют просмотреть все повороты и переходы между фазами.

Язык можно сменить в **Настройках**. Автосохранение и история привязаны к адресу сайта и браузеру. Для переноса задачи с прежнего сайта сохраните её в JSON и откройте этот файл на новом адресе. Русскоязычный LaTeX-экспорт требует поддержки кириллицы в используемом редакторе или компиляторе.
