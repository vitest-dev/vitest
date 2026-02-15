import { describe, expect, it } from 'vitest'
import { render } from './utils'

const categories = [
  {value: '', label: '–'},
  {value: 'design', label: 'Design'},
  {value: 'ux', label: 'User Experience'},
  {value: 'programming', label: 'Programming'},
]

const skills = [
  {value: 'c-sharp', label: 'C#'},
  {value: 'graphql', label: 'GraphQl'},
  {value: 'javascript', label: 'JavaScript'},
  {value: 'ruby-on-rails', label: 'Ruby on Rails'},
  {value: 'python', label: 'Python'},
]

const defaultValues = {
  title: 'Full-stack developer',
  salary: 12345,
  category: 'programming',
  skills: ['javascript', 'ruby-on-rails'],
  description: 'You need to know your stuff',
  remote: true,
  freelancing: false,
  'is%Private^': true,
  'benefits[0]': 'Fruit & free drinks everyday',
  'benefits[1]': 'Multicultural environment',
}

function renderForm({
  selectSingle = renderSelectSingle,
  selectMultiple = renderSelectMultiple,
  values: valueOverrides = {},
} = {}) {
  const values = {
    ...defaultValues,
    ...valueOverrides,
  }
  const {container} = render(`
    <form>
      <label for="title">Job title</label>
      <input
        type="text"
        id="title"
        name="title"
        value="${values.title || ''}"
      />

      <label for="salary">Salary</label>
      <input
        type="number"
        id="salary"
        name="salary"
        value="${values.salary}"
      />

      <label for="description">Description</label>
      <textarea id="description" name="description">${
        values.description
      }</textarea>

      <input
        type="checkbox"
        id="remote"
        name="remote" ${values.remote ? 'checked' : ''}
      />
      <label for="remote">Can work remotely?</label>

      <input
        type="checkbox"
        id="freelancing"
        name="freelancing" ${values.freelancing ? 'checked' : ''}
      />
      <label for="freelancing">Freelancing?</label>

      <fieldset>
        <legend>Benefits</legend>
        <input
          type="text"
          id="benefits[0]"
          name="benefits[0]"
          value="${values['benefits[0]']}"
        />
        <input
          type="text"
          id="benefits[1]"
          name="benefits[1]"
          value="${values['benefits[1]']}"
        />
      </fieldset>

      <label for="is%Private^">Is Private</label>
      <input
        type="checkbox"
        id="is%Private^"
        name="is%Private^"
        name="isPrivate" ${values['is%Private^'] ? 'checked' : ''}
      />

      ${selectSingle('category', 'Category', categories, values.category)}
      ${selectMultiple('skills', 'Skills', skills, values.skills)}
    </form>
  `)
  return container.querySelector('form')
}

describe('.toHaveFormValues', () => {
  it('works as expected', () => {
    expect(renderForm()).toHaveFormValues(defaultValues)
  })

  it('allows to match partially', () => {
    expect(renderForm()).toHaveFormValues({
      category: 'programming',
      salary: 12345,
    })
  })

  it('supports checkboxes for multiple selection', () => {
    expect(renderForm({selectMultiple: renderCheckboxes})).toHaveFormValues({
      skills: ['javascript', 'ruby-on-rails'],
    })
  })

  it('supports radio-buttons for single selection', () => {
    expect(renderForm({selectSingle: renderRadioButtons})).toHaveFormValues({
      category: 'programming',
    })
  })

  it('matches sets of selected values regardless of the order', () => {
    const form = renderForm()
    expect(form).toHaveFormValues({
      skills: ['ruby-on-rails', 'javascript'],
    })
    expect(form).toHaveFormValues({
      skills: ['javascript', 'ruby-on-rails'],
    })
  })

  it('correctly handles empty values', () => {
    expect(
      renderForm({
        values: {
          title: '',
          salary: null,
          category: null,
          skills: [],
          description: '',
        },
      }),
    ).toHaveFormValues({
      title: '',
      salary: null,
      category: '',
      skills: [],
      description: '',
    })
  })

  it('handles <input type="number"> values correctly', () => {
    expect(renderForm({values: {salary: 123.456}})).toHaveFormValues({
      salary: 123.456,
    })
    expect(renderForm({values: {salary: '1e5'}})).toHaveFormValues({
      salary: 1e5,
    })
    expect(renderForm({values: {salary: '1.35e5'}})).toHaveFormValues({
      salary: 135000,
    })
    expect(renderForm({values: {salary: '-5.9'}})).toHaveFormValues({
      salary: -5.9,
    })
  })

  describe('edge cases', () => {
    // This is also to ensure 100% code coverage for edge cases
    it('detects multiple elements with the same name but different type', () => {
      const {container} = render(`
        <form>
          <input type="checkbox" name="accept">
          <input type="radio" name="accept">
        </form>
      `)
      const form = container.querySelector('form')
      expect(() => {
        expect(form).toHaveFormValues({})
      }).toThrow(/must be of the same type/)
    })

    it('detects multiple elements with the same type and name', () => {
      const {container} = render(`
        <form>
          <input type="text" name="title" value="one">
          <input type="text" name="title" value="two">
        </form>
      `)
      const form = container.querySelector('form')
      expect(form).toHaveFormValues({
        title: ['one', 'two'],
      })
    })

    it('supports radio buttons with none selected', () => {
      expect(
        renderForm({
          selectSingle: renderRadioButtons,
          values: {category: undefined},
        }),
      ).toHaveFormValues({
        category: undefined,
      })
    })

    it('supports being called only on form and fieldset elements', () => {
      const expectedValues = {title: 'one', description: 'two'}
      const {container} = render(`
        <form>
          <input type="text" name="title" value="one">
          <input type="text" name="description" value="two">
        </form>
      `)
      const form = container.querySelector('form')
      expect(() => {
        expect(container).toHaveFormValues(expectedValues)
      }).toThrow(/a form or a fieldset/)
      expect(() => {
        expect(form).toHaveFormValues(expectedValues)
      }).not.toThrow()
    })

    it('matches change in selected value of select', () => {
      const oldValue = ''
      const newValue = 'design'

      const {container} = render(`
        <form>
          ${renderSelectSingle('category', 'Category', categories, oldValue)}
        </form>
      `)

      const form = container.querySelector('form')
      const select = container.querySelector('select')
      expect(form).toHaveFormValues({category: oldValue})

      select.value = newValue
      expect(form).toHaveFormValues({category: newValue})
    })
  })

  describe('failed assertions', () => {
    it('work as expected', () => {
      expect(() => {
        expect(renderForm()).not.toHaveFormValues(defaultValues)
      }).toThrow(/Expected the element not to have form values/)
      expect(() => {
        expect(renderForm()).toHaveFormValues({something: 'missing'})
      }).toThrow(/Expected the element to have form values/)
    })
  })
})

// Form control renderers

function isSelected(value, option) {
  return Array.isArray(value) && value.indexOf(option.value) >= 0
}

function renderCheckboxes(name, label, options, value = []) {
  return `
    <fieldset>
      <legend>${label}</legend>
      ${renderList(
        options,
        option => `
          <div>
            <input
              type="checkbox"
              name="${name}[]"
              id="${option.value}"
              value="${option.value}"
              ${isSelected(value, option) ? 'checked' : ''}
            />
            <label for="${option.value}">${option.label}</label>
          </div>
        `,
      )}
    </fieldset>
  `
}

function renderRadioButtons(name, label, options, value = undefined) {
  return `
    <fieldset>
      <legend>${label}</legend>
      ${renderList(
        options,
        option => `
          <div>
            <input
              type="radio"
              name="${name}"
              id="${option.value}"
              value="${option.value}"
              ${value === option.value ? 'checked' : ''}
            />
            <label for="${option.value}">${option.label}</label>
          </div>
        `,
      )}
    </fieldset>
  `
}

function renderSelect(name, label, options, value, multiple) {
  return `
    <label for="${name}">${label}</label>
    <select id="${name}" name="${name}" ${multiple ? 'multiple' : ''}>
      ${renderList(
        options,
        option => `
          <option
            value="${option.value}"
            ${isSelected(value, option) ? 'selected' : ''}
          >
            ${option.label}
          </option>
        `,
      )}
    </select>
  `
}

function renderSelectSingle(name, label, options, value = undefined) {
  return renderSelect(
    name,
    label,
    options,
    value === undefined || value === null ? [] : [value],
    false,
  )
}

function renderSelectMultiple(name, label, options, value = []) {
  return renderSelect(name, label, options, value, true)
}

function renderList(items, mapper) {
  return items.map(mapper).join('')
}