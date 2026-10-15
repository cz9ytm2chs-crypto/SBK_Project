import { Ruler } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Table, Td, Th } from '@/components/ui/data';

const APPAREL = [
  ['XS', '44', '84–88', '70–74', '164–170'],
  ['S', '46', '88–92', '74–78', '170–176'],
  ['M', '48', '92–96', '78–82', '176–182'],
  ['L', '50', '96–100', '82–86', '182–188'],
  ['XL', '52', '100–106', '86–92', '186–192'],
  ['XXL', '54', '106–112', '92–98', '188–194'],
];
const SHOES = [
  ['39', '6', '25,0'],
  ['40', '7', '25,7'],
  ['41', '8', '26,3'],
  ['42', '9', '27,0'],
  ['43', '10', '27,7'],
  ['44', '11', '28,3'],
  ['45', '12', '29,0'],
];

export function SizeGuide({ group }: { group: 'APPAREL' | 'SHOES' | 'ONE_SIZE' }) {
  if (group === 'ONE_SIZE') return null;
  const shoes = group === 'SHOES';
  return (
    <Dialog>
      <DialogTrigger className="flex items-center gap-1.5 text-xs text-stone underline underline-offset-4 hover:text-ink">
        <Ruler className="size-3.5" /> Таблица размеров
      </DialogTrigger>
      <DialogContent title="Таблица размеров" description={shoes ? 'Измерьте длину стопы от пятки до большого пальца.' : 'Обхваты указаны в сантиметрах.'} className="max-w-xl">
        <Table>
          <thead>
            <tr>
              {(shoes ? ['RU', 'US', 'Стопа, см'] : ['Размер', 'RU', 'Грудь', 'Талия', 'Рост']).map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(shoes ? SHOES : APPAREL).map((row) => (
              <tr key={row[0]}>
                {row.map((c, i) => (
                  <Td key={i} className={i === 0 ? 'font-medium' : 'text-graphite'}>
                    {c}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-5 text-xs text-stone">Если вы между размерами, ориентируйтесь на комментарий о посадке в описании товара или напишите нам — подскажем.</p>
      </DialogContent>
    </Dialog>
  );
}
