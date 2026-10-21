import { Check, ChevronDown, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { CONTROL_HEIGHT, CONTROL_PADDING, CONTROL_TEXT, type ControlSize } from './control';
import { FIELD_BASE, fieldBorder, fieldErrorId } from './field';
import { FieldError } from './field-error';
import { IconButton } from './icon-button';
import { Label } from './label';
import type { SelectOption } from './select';

export interface ComboboxProps {
  id?: string | undefined;
  label?: string | undefined;
  error?: string | undefined;
  /** Shows the asterisk on the label and sets `aria-required`. */
  isRequired?: boolean | undefined;
  size?: ControlSize | undefined;
  options: readonly SelectOption[];
  /** The selected option's value, or `''` for none. */
  value: string;
  onChange: (value: string) => void;
  /** Shown while nothing is selected and the field is not being typed in. */
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  /** Hides the clear button for a field that must keep a value once it has one. */
  isClearable?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Strips the accents Vietnamese place names carry, so typing `ha noi` finds
 * `Hà Nội`. A user who reaches for a 34-province list on a laptop keyboard
 * rarely types the tone marks, and an exact-substring filter answers "no match"
 * to a name that is plainly there.
 *
 * `đ` survives NFD — it is a letter, not a letter plus a mark — so it is mapped
 * by hand; without that line `da nang` misses `Đà Nẵng`.
 */
function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/gu, '')
    .replaceAll(/[đĐ]/gu, 'd')
    .toLowerCase()
    .trim();
}

/** Where the list is drawn, in viewport coordinates. */
interface Anchor {
  top: number;
  left: number;
  width: number;
}

const LIST_MAX_HEIGHT = 288;
const VIEWPORT_MARGIN = 8;

/**
 * A single-choice control that filters its own options as you type — the
 * searchable half of `Select`.
 *
 * `Select` is still the right control for a handful of fixed choices. This one
 * exists for lists nobody can scan: a province list of 34 and a ward list that
 * runs into the hundreds, where scrolling to `Phường Tân Thạnh` costs more than
 * typing it.
 *
 * The field itself is the search box (the editable-combobox pattern) rather than
 * a trigger that opens a popup holding a second input. That keeps exactly one
 * focusable element, which matters because these fields live inside `SidePanel`,
 * whose focus trap cycles Tab through the panel's own elements — an input
 * portalled outside the panel would be skipped by Tab and reachable only by
 * mouse. The list is portalled, but it is driven by `aria-activedescendant` and
 * never takes focus, so the trap stays intact.
 *
 * The list is in a portal and positioned in viewport coordinates because the
 * panel body scrolls (`overflow-y-auto`), and an absolutely positioned list
 * would be clipped by it rather than floating over the form.
 */
export function Combobox({
  id,
  label,
  error,
  isRequired = false,
  size = 'md',
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  isClearable = true,
  className,
}: ComboboxProps) {
  const { t } = useTranslation('common');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listId = `${fieldId}-list`;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const hasError = error !== undefined && error !== '';
  const selected = options.find((option) => option.value === value);

  const matches = useMemo(() => {
    const needle = foldForSearch(query);
    if (needle === '') return options;
    return options.filter((option) => foldForSearch(option.label).includes(needle));
  }, [options, query]);

  /*
   * The field shows the selected label at rest and the query while open, so
   * opening a filled field does not make the user delete a name to search.
   */
  const text = isOpen ? query : (selected?.label ?? '');

  const place = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;

    const below = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const above = rect.top - VIEWPORT_MARGIN;
    // Flip above the field when the space under it cannot hold a usable list.
    const flips = below < LIST_MAX_HEIGHT && above > below;

    setAnchor({
      top: flips
        ? Math.max(rect.top - Math.min(LIST_MAX_HEIGHT, above), VIEWPORT_MARGIN)
        : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const open = (): void => {
    if (disabled || isOpen) return;
    setQuery('');
    setActiveIndex(
      Math.max(
        options.findIndex((option) => option.value === value),
        0,
      ),
    );
    setIsOpen(true);
  };

  const close = (): void => {
    setIsOpen(false);
    setQuery('');
  };

  const choose = (option: SelectOption): void => {
    onChange(option.value);
    close();
  };

  useLayoutEffect(() => {
    if (isOpen) place();
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;
    /*
     * Capture, so the panel's own scrolling moves the list with the field;
     * a scroll listener on `window` alone never hears a nested scroller.
     */
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isOpen, place]);

  // Keep the active option in view while the arrow keys walk a long ward list.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      if (matches.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (index + step + matches.length) % matches.length);
      return;
    }

    if (event.key === 'Enter') {
      if (!isOpen) return;
      // Without this the Enter that picks a ward also submits the form.
      event.preventDefault();
      const option = matches[activeIndex];
      if (option) choose(option);
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      // The surrounding SidePanel closes on Escape from a document listener;
      // the first Escape belongs to the list, not to the panel.
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === 'Tab' && isOpen) close();
  };

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label === undefined ? null : (
        <Label htmlFor={fieldId} isRequired={isRequired}>
          {label}
        </Label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-required={isRequired}
          aria-controls={listId}
          aria-invalid={hasError}
          aria-describedby={fieldErrorId(fieldId, hasError)}
          {...(isOpen && matches[activeIndex]
            ? { 'aria-activedescendant': `${listId}-${String(activeIndex)}` }
            : {})}
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onChange={(event) => {
            if (!isOpen) setIsOpen(true);
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onMouseDown={open}
          onFocus={open}
          onBlur={close}
          onKeyDown={onKeyDown}
          className={cn(
            FIELD_BASE,
            fieldBorder(hasError),
            CONTROL_HEIGHT[size],
            CONTROL_PADDING[size],
            CONTROL_TEXT[size],
            'cursor-text pr-9',
            isClearable && value !== '' && !disabled ? 'pr-16' : '',
          )}
        />
        {isClearable && value !== '' && !disabled ? (
          <span className="absolute inset-y-0 right-7 flex items-center">
            <IconButton
              size="sm"
              variant="ghost"
              label={t('combobox.clear')}
              icon={<X aria-hidden="true" className="size-4" />}
              // `blur` would close the list before the click landed.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                onChange('');
                setQuery('');
                inputRef.current?.focus();
              }}
            />
          </span>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 my-auto size-4"
        />
      </div>
      {hasError ? <FieldError id={fieldErrorId(fieldId, true)}>{error}</FieldError> : null}

      {isOpen && anchor
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              style={{
                top: anchor.top,
                left: anchor.left,
                width: anchor.width,
                maxHeight: LIST_MAX_HEIGHT,
              }}
              // The field keeps focus: a list that steals it would close itself.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              className="bg-card border-border rounded-surface shadow-overlay fixed z-50 overflow-y-auto border p-1"
            >
              {matches.length === 0 ? (
                <li className="text-muted-foreground text-label px-2 py-2">
                  {t('combobox.empty')}
                </li>
              ) : (
                matches.map((option, index) => (
                  /*
                   * The option is a button inside a presentational `li`: the
                   * keyboard path is the input's own handler plus
                   * `aria-activedescendant`, and a plain `li` with a click
                   * handler would be a control no keyboard can reach. `li`
                   * keeps the list valid — a `ul` may only hold list items.
                   */
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${String(index)}`}
                      role="option"
                      aria-selected={option.value === value}
                      // The field keeps focus; the list is never a tab stop.
                      tabIndex={-1}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                      }}
                      onClick={() => {
                        choose(option);
                      }}
                      className={cn(
                        'text-body text-foreground rounded-inner flex w-full cursor-pointer items-center gap-2 px-2 text-left',
                        CONTROL_HEIGHT.sm,
                        index === activeIndex ? 'bg-muted' : '',
                      )}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {option.value === value ? (
                          <Check aria-hidden="true" className="text-primary size-3.5" />
                        ) : null}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
