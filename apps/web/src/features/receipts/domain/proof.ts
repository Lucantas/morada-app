export function isAllowedProof(dataUrl: string): boolean {
  return /^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i.test(dataUrl);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}
