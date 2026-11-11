/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端接口地址前缀，默认空串（同源相对路径） */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
