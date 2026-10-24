export const inputClass = (hasError) =>
  `w-full h-12 px-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-secondary focus:outline-none focus:bg-surface-container-lowest font-body-md text-body-md transition-all ${
    hasError ? 'ring-2 ring-error' : 'focus:ring-2 focus:ring-primary-container'
  }`

export function ErrorText({ children }) {
  if (!children) return null
  return (
    <div className="flex items-center gap-1.5 mt-2 text-error font-body-sm text-body-sm">
      <span className="material-symbols-outlined text-[18px]">error</span>
      <span>{children}</span>
    </div>
  )
}

export function Field({ label, htmlFor, required, optional, error, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label
          htmlFor={htmlFor}
          className="block font-label-md text-label-md text-on-surface"
        >
          {label} {required && <span className="text-error">*</span>}
        </label>
        {optional && (
          <span className="font-body-sm text-body-sm text-secondary">Optional</span>
        )}
      </div>
      {children}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

export function PhoneInput({ id, value, onChange, placeholder, error, maxLength = 11 }) {
  return (
    <div
      className={`flex items-center rounded-lg bg-surface-container-low px-4 focus-within:bg-surface-container-lowest transition-all ${
        error ? 'ring-2 ring-error' : 'focus-within:ring-2 focus-within:ring-primary-container'
      }`}
    >
      <span className="font-body-md text-body-md text-secondary font-medium mr-2">+91</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder}
        className="w-full h-12 bg-transparent text-on-surface placeholder:text-secondary focus:outline-none font-body-md text-body-md"
      />
    </div>
  )
}