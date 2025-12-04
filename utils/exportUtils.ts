
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas';

export const shareElementAsImage = async (elementId: string, title: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Measure original content width. 
  // Add padding to ensure no edge clipping.
  const contentWidth = element.scrollWidth;
  const EXPORT_WIDTH = Math.max(contentWidth + 50, 1000); // Increased min width for safety

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0'; 
  container.style.zIndex = '-9999';
  container.style.width = `${EXPORT_WIDTH}px`;
  // Ensure container allows height expansion
  container.style.height = 'auto';
  document.body.appendChild(container);

  const clone = element.cloneNode(true) as HTMLElement;
  
  // Apply styles to clone to ensure full visibility and correct layout
  clone.style.width = `${EXPORT_WIDTH}px`;
  clone.style.minWidth = `${EXPORT_WIDTH}px`;
  clone.style.height = 'auto'; 
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.padding = '20px';
  clone.style.border = 'none';
  
  // Force table layout to auto to allow expansion
  const tables = clone.getElementsByTagName('table');
  for (let i = 0; i < tables.length; i++) {
      tables[i].style.width = '100%';
      tables[i].style.tableLayout = 'auto';
  }

  // Handle Dark Mode
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
      clone.classList.add('dark');
      clone.style.backgroundColor = '#111827';
      clone.style.color = '#f3f4f6';
  } else {
      clone.classList.remove('dark');
      clone.style.backgroundColor = '#ffffff';
      clone.style.color = '#111827';
  }

  // Replace Inputs/Textareas with Divs for proper rendering
  // We need to match elements by traversing both trees
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
           
           // Copy visual styles
           div.style.backgroundColor = computed.backgroundColor;
           div.style.border = computed.border;
           div.style.borderRadius = computed.borderRadius;
           div.style.padding = computed.padding;
           div.style.color = computed.color;
           div.style.fontSize = computed.fontSize;
           div.style.fontWeight = computed.fontWeight;
           div.style.textAlign = computed.textAlign;
           div.style.fontFamily = computed.fontFamily;

           // Layout styles to ensure visibility
           div.style.display = 'flex';
           div.style.alignItems = 'center';
           div.style.minHeight = computed.height === 'auto' ? '30px' : computed.height;
           div.style.width = 'auto'; 
           div.style.minWidth = '100%';
           div.style.whiteSpace = 'pre-wrap';
           div.style.wordBreak = 'break-word';
           
           // Flex alignment based on text align and direction (RTL)
           if (computed.textAlign === 'center') div.style.justifyContent = 'center';
           else if (computed.textAlign === 'left') div.style.justifyContent = 'flex-end'; 
           else div.style.justifyContent = 'flex-start'; // Right (default RTL)

           div.textContent = input.value;

           if (cloned.parentNode) cloned.parentNode.replaceChild(div, cloned);

      } else if (original.tagName === 'SELECT') {
           const select = original as HTMLSelectElement;
           const div = document.createElement('div');
           const computed = window.getComputedStyle(original);
           
           div.className = cloned.className;
           div.style.backgroundColor = computed.backgroundColor;
           div.style.border = computed.border;
           div.style.borderRadius = computed.borderRadius;
           div.style.padding = computed.padding;
           div.style.color = computed.color;
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

  // Footer
  const footer = document.createElement('div');
  footer.innerText = 'جواد بابائی | mrhonaramoz.ir';
  footer.style.textAlign = 'center';
  footer.style.marginTop = '24px';
  footer.style.paddingTop = '12px';
  footer.style.borderTop = isDark ? '1px solid #374151' : '1px solid #e5e7eb';
  footer.style.fontSize = '12px';
  footer.style.fontWeight = '700';
  footer.style.color = isDark ? '#9ca3af' : '#6b7280';
  footer.style.fontFamily = 'Vazirmatn, sans-serif';
  clone.appendChild(footer);

  container.appendChild(clone);

  // Allow time for rendering
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: isDark ? '#111827' : '#ffffff',
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
