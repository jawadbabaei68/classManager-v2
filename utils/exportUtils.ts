
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';

export const shareElementAsImage = async (elementId: string, title: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Measure original content width. 
  const contentWidth = element.scrollWidth;
  const EXPORT_WIDTH = Math.max(contentWidth + 50, 1000); 

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0'; 
  container.style.zIndex = '-9999';
  container.style.width = `${EXPORT_WIDTH}px`;
  container.style.height = 'auto';
  document.body.appendChild(container);

  const clone = element.cloneNode(true) as HTMLElement;
  
  // FORCE LIGHT MODE: Remove 'dark' class and enforce white background/dark text
  clone.classList.remove('dark');
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#1f2937'; // Gray-800
  
  // Apply specific styles for export container
  clone.style.width = `${EXPORT_WIDTH}px`;
  clone.style.minWidth = `${EXPORT_WIDTH}px`;
  clone.style.height = 'auto'; 
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.padding = '20px';
  clone.style.border = 'none';
  
  // Force table layout to auto
  const tables = clone.getElementsByTagName('table');
  for (let i = 0; i < tables.length; i++) {
      tables[i].style.width = '100%';
      tables[i].style.tableLayout = 'auto';
      // Ensure table text is dark
      tables[i].style.color = '#1f2937';
  }

  // Handle Inputs/Textareas
  const originalInputs = element.querySelectorAll('input, textarea, select');
  const cloneInputs = clone.querySelectorAll('input, textarea, select');

  for (let i = 0; i < originalInputs.length; i++) {
      const original = originalInputs[i] as HTMLElement;
      const cloned = cloneInputs[i] as HTMLElement;

      if (original.tagName === 'INPUT' || original.tagName === 'TEXTAREA') {
           const input = original as HTMLInputElement;
           if (input.type === 'checkbox' || input.type === 'radio') {
               (cloned as HTMLInputElement).checked = input.checked;
               continue;
           }

           const div = document.createElement('div');
           const computed = window.getComputedStyle(original);
           
           div.className = cloned.className;
           
           // Force light styling for values
           div.style.backgroundColor = '#ffffff'; // White bg
           div.style.border = '1px solid #e5e7eb'; // Light gray border
           div.style.borderRadius = computed.borderRadius;
           div.style.padding = computed.padding;
           div.style.color = '#000000'; // Black text
           div.style.fontSize = computed.fontSize;
           div.style.fontWeight = computed.fontWeight;
           div.style.textAlign = computed.textAlign;
           div.style.fontFamily = computed.fontFamily;

           div.style.display = 'flex';
           div.style.alignItems = 'center';
           div.style.minHeight = computed.height === 'auto' ? '30px' : computed.height;
           div.style.width = 'auto'; 
           div.style.minWidth = '100%';
           div.style.whiteSpace = 'pre-wrap';
           div.style.wordBreak = 'break-word';
           
           if (computed.textAlign === 'center') div.style.justifyContent = 'center';
           else if (computed.textAlign === 'left') div.style.justifyContent = 'flex-end'; 
           else div.style.justifyContent = 'flex-start';

           div.textContent = input.value;

           if (cloned.parentNode) cloned.parentNode.replaceChild(div, cloned);

      } else if (original.tagName === 'SELECT') {
           const select = original as HTMLSelectElement;
           const div = document.createElement('div');
           const computed = window.getComputedStyle(original);
           
           div.className = cloned.className;
           // Force light styling
           div.style.backgroundColor = '#ffffff';
           div.style.border = '1px solid #e5e7eb';
           div.style.borderRadius = computed.borderRadius;
           div.style.padding = computed.padding;
           div.style.color = '#000000';
           div.style.fontSize = computed.fontSize;
           div.style.textAlign = computed.textAlign;

           div.style.display = 'flex';
           div.style.alignItems = 'center';
           div.style.justifyContent = 'center';
           div.style.minHeight = computed.height;
           div.style.width = '100%';

           div.textContent = select.options[select.selectedIndex]?.text || '';
           
           if (cloned.parentNode) cloned.parentNode.replaceChild(div, cloned);
      }
  }

  // Ensure all text elements in clone are dark
  const allElements = clone.querySelectorAll('*');
  allElements.forEach((el) => {
      if (el instanceof HTMLElement) {
          // If explicitly white text from dark mode, make it dark
          if (el.classList.contains('text-white') || el.classList.contains('dark:text-white')) {
             el.style.color = '#1f2937';
             el.classList.remove('text-white', 'dark:text-white');
          }
          // If bg is dark, make it white/light
          if (el.classList.contains('bg-gray-800') || el.classList.contains('dark:bg-gray-800')) {
             el.style.backgroundColor = '#ffffff';
          }
          if (el.classList.contains('bg-gray-700') || el.classList.contains('dark:bg-gray-700')) {
             el.style.backgroundColor = '#f3f4f6';
          }
      }
  });

  // Footer
  const footer = document.createElement('div');
  footer.innerText = 'جواد بابائی | mrhonaramoz.ir';
  footer.style.textAlign = 'center';
  footer.style.marginTop = '24px';
  footer.style.paddingTop = '12px';
  footer.style.borderTop = '1px solid #e5e7eb';
  footer.style.fontSize = '12px';
  footer.style.fontWeight = '700';
  footer.style.color = '#6b7280';
  footer.style.fontFamily = 'Vazirmatn, sans-serif';
  clone.appendChild(footer);

  container.appendChild(clone);

  // Allow time for rendering
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff', // Force white canvas bg
      width: EXPORT_WIDTH,
      windowWidth: EXPORT_WIDTH,
      height: clone.offsetHeight + 40,
      windowHeight: clone.offsetHeight + 40,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (Capacitor.isNativePlatform()) {
      const fileName = `${title}_${Date.now()}.jpg`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: dataUrl.split(',')[1],
        directory: Directory.Cache
      });

      await Share.share({
        title: title,
        files: [savedFile.uri],
      });
    } else {
      const link = document.createElement('a');
      link.download = `${title}.jpg`;
      link.href = dataUrl;
      link.click();
    }
  } catch (error) {
    console.error('Sharing failed', error);
    alert('خطا در تولید تصویر گزارش');
  } finally {
    document.body.removeChild(container);
  }
};
