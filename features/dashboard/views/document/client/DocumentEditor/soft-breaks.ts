import { Transforms, type Editor } from 'slate'

export function withSoftBreaks(editor: Editor): Editor {
  // Soft breaks work in every block.
  editor.insertSoftBreak = () => {
    Transforms.insertText(editor, '\n')
  }
  return editor
}
