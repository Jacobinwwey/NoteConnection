describe('NoteConnection Android smoke', () => {
  it('boots into a visible WebView shell', async () => {
    const webView = element(by.type('android.webkit.WebView'));
    await waitFor(webView).toBeVisible().withTimeout(20000);
    await expect(webView).toBeVisible();
  });
});
