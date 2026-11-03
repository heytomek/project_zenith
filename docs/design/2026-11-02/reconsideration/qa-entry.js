async (page) => {
  const checks = [];
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const library = () => page.evaluate(() => JSON.parse(localStorage.getItem('zenith.coordination.v2')));
  const active = (lib) => lib.workspaces.find(w => w.profile.id === lib.activeId);
  await page.goto('http://127.0.0.1:3107/#situation');
  await page.setViewportSize({ width: 320, height: 844 });
  let lib = await library();
  await page.getByRole('banner').getByRole('button', { name: active(lib).profile.name, exact: true }).click();
  await page.locator('.profile-option').filter({ hasText: 'Meridian' }).filter({ hasNotText: '· case' }).click();
  await page.getByRole('banner').getByRole('button', { name: 'Meridian', exact: true }).click();
  const dialog = page.getByRole('dialog');
  check(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth) && await dialog.getByRole('button', { name: 'Explore', exact: true }).isVisible(), 'existing users can reach Explore in a world picker that fits 320px');
  const before = await library();
  await dialog.getByRole('button', { name: 'Explore', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  lib = await library();
  check(lib.workspaces.length === before.workspaces.length + 1 && lib.activeId !== before.activeId, 'Explore appends an independent active case');
  check(before.workspaces.every(w => JSON.stringify(lib.workspaces.find(next => next.profile.id === w.profile.id)) === JSON.stringify(w)), 'Explore preserves every existing workspace byte for byte');
  check(active(lib).profile.name === 'Meridian · case' && active(lib).mandates.some(m => m.status === 'blocked') && await page.locator('.course-review').count() === 1 && await page.locator('.decision-context').count() === 0, 'the active case has one canonical review action and a live exception');
  return { passed: checks.length, checks };
}
