import {test,expect} from '@playwright/test';

test('F6: Notebook links an actual saved run, persists local notes and generates measured evidence',async({page})=>{
  await page.goto('/app/playground');
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  await page.getByRole('button',{name:'Save Run',exact:true}).click();
  await page.goto('/app/experiments');
  const notebook=page.getByRole('region',{name:'Research Notebook'});
  await expect(notebook).toBeVisible();
  const runCheck=notebook.getByRole('checkbox',{name:/Include run/}).first();
  await expect(runCheck).toBeVisible();
  await runCheck.check();
  await notebook.getByRole('textbox',{name:'Notebook title'}).fill('Two Moons Research');
  await notebook.getByRole('textbox',{name:'Notebook observations'}).fill('Investigated recorded validation evidence.');
  await notebook.getByRole('textbox',{name:'Notebook limitations'}).fill('Single dataset and seed.');
  await notebook.getByRole('button',{name:'Save notebook locally'}).click();
  await expect(notebook.getByText('Notebook saved locally.')).toBeVisible();
  await notebook.getByRole('button',{name:'Generate evidence report'}).click();
  const report=notebook.getByRole('region',{name:'Generated research report'});
  await expect(report).toBeVisible();
  await expect(report.getByRole('textbox',{name:'Research report Markdown'})).toContainText('Two Moons Research');
  await page.reload();
  await expect(page.getByRole('region',{name:'Research Notebook'}).getByRole('textbox',{name:'Notebook observations'}))
    .toHaveValue('Investigated recorded validation evidence.');
});

test('F6: Notebook refuses to invent a report when no runs are selected',async({page})=>{
  await page.goto('/app/experiments');
  const notebook=page.getByRole('region',{name:'Research Notebook'});
  await expect(notebook).toBeVisible();
  await notebook.getByRole('button',{name:'Generate evidence report'}).click();
  await expect(notebook.getByRole('alert')).toContainText('REPORT_RUNS_REQUIRED');
});
