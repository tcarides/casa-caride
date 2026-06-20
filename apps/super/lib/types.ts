// Tipos compartidos de la lista del súper.

export interface Category {
  id: number
  name: string
  position: number
}

export interface Item {
  // Puede ser un id temporal ("tmp-…") mientras el server confirma el alta.
  id: number | string
  name: string
  categoryId: number | null
  needed: boolean
  checked: boolean
  quantity: number
  note: string | null
}

export interface AppState {
  categories: Category[]
  items: Item[]
}

export interface Group {
  id: number | null
  name: string
  items: Item[]
}

// Datos del formulario de edición (valores crudos del form).
export interface EditForm {
  name: string
  categoryId: string
  quantity: number
  note: string
}
