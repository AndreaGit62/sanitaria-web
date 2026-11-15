import Link from 'next/link';
import DemoDashboard from '../../components/demo-dashboard';
export default function DemoPage() {
  return <><div className="demo-access"><span>Spazio dimostrativo: usa solo dati inventati.</span><Link href="/">Torna al tuo spazio →</Link></div><DemoDashboard/></>;
}
