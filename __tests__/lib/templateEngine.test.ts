import { describe, it, expect } from 'vitest';
import { render } from '../../lib/templateEngine';

describe('render', () => {
  it('substitutes a single variable', () => {
    expect(render('Hello [[NAME]]!', { NAME: 'World' })).toBe('Hello World!');
  });

  it('substitutes multiple variables', () => {
    const result = render('[[A]] and [[B]]', { A: 'foo', B: 'bar' });
    expect(result).toBe('foo and bar');
  });

  it('renders a section loop', () => {
    const tpl = '[[# items ]][[.]], [[/ items ]]';
    const result = render(tpl, { items: ['x', 'y', 'z'] });
    expect(result).toBe('x, y, z, ');
  });

  it('renders an object loop with named keys', () => {
    const tpl = '[[# rows ]][[name]]=[[value]];[[/ rows ]]';
    const result = render(tpl, { rows: [{ name: 'a', value: '1' }, { name: 'b', value: '2' }] });
    expect(result).toBe('a=1;b=2;');
  });

  it('renders a conditional block when truthy', () => {
    const tpl = '[[# show ]]yes[[/ show ]]';
    expect(render(tpl, { show: true })).toBe('yes');
    expect(render(tpl, { show: false })).toBe('');
  });

  it('renders an inverted block when falsy', () => {
    const tpl = '[[^ empty ]]fallback[[/ empty ]]';
    expect(render(tpl, { empty: '' })).toBe('fallback');
    expect(render(tpl, { empty: 'something' })).toBe('');
  });

  it('does not HTML-escape special characters', () => {
    const result = render('[[VAL]]', { VAL: '\\textbf{Hello} & <World>' });
    expect(result).toBe('\\textbf{Hello} & <World>');
  });

  it('leaves LaTeX commands untouched in the template', () => {
    const tpl = '\\cvsection{[[TITLE]]}';
    expect(render(tpl, { TITLE: 'Skills' })).toBe('\\cvsection{Skills}');
  });

  it('returns empty string for missing variable', () => {
    expect(render('[[MISSING]]', {})).toBe('');
  });
});
