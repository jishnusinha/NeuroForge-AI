import { test, expect } from '@playwright/test';

test('all ten themes preserve readable workspace surfaces on desktop and mobile', async ({ page }, info) => {
  await page.goto('/app');
  const selector = page.getByRole('combobox', { name: 'Visual theme' });
  const workspace = page.locator('#main-content');

  await expect(selector).toBeVisible();
  await expect(workspace).toBeVisible();

  const ids = ['midnight','slate','forest','paper','glacier','dusk','ocean','sand','rose','contrast'];
  const measurements=[];
  for (const id of ids) {
    await selector.selectOption(id);
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    const result=await page.evaluate(()=>{
      const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
      const linear=value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;};
      const luminance=color=>{const [r,g,b]=rgb(color).map(linear);return .2126*r+.7152*g+.0722*b;};
      const contrast=(foreground,background)=>{const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
      const root=getComputedStyle(document.documentElement),main=document.querySelector('#main-content'),side=document.querySelector('[aria-label="Workspace sidebar"]'),heading=document.querySelector('header h1');
      const fg=getComputedStyle(heading).color,bg=getComputedStyle(main).backgroundColor;
      return {background:bg,sidebar:getComputedStyle(side).backgroundColor,heading:fg,headingContrast:Number(contrast(fg,bg).toFixed(2)),scrollWidth:document.documentElement.scrollWidth,width:innerWidth,mode:root.colorScheme};
    });
    measurements.push({id,...result});
    expect(result.headingContrast,`${id} heading contrast`).toBeGreaterThanOrEqual(4.5);
    expect(result.scrollWidth,`${id} horizontal overflow`).toBeLessThanOrEqual(result.width);
  }
  await info.attach('all-theme-workspace-contrast',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
  await selector.selectOption('paper');
  await page.reload();
  await expect(selector).toHaveValue('paper');
  await expect(page.locator('html')).toHaveAttribute('data-theme','paper');
  await expect.poll(() => page.evaluate(()=>getComputedStyle(document.querySelector('header h1')).color)).not.toBe('rgb(255, 255, 255)');
});
