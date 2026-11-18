// The native iOS time wheel (Expo UI's SwiftUI DatePicker), for the Settings reminder time.
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden } from '@expo/ui/swift-ui/modifiers';

export function TimeWheel({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  return (
    <Host matchContents colorScheme="dark">
      <DatePicker
        selection={value}
        displayedComponents={['hourAndMinute']}
        onDateChange={onChange}
        modifiers={[datePickerStyle('wheel'), labelsHidden()]}
      />
    </Host>
  );
}
