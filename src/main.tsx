import {StrictMode,Component,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends Component<{children:ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(error:Error){return {error:error.message}}render(){return this.state.error?<div className="fatal"><h1>页面遇到了问题</h1><p>{this.state.error}</p><button onClick={()=>{location.hash='/overview';location.reload()}}>回到架构地图</button></div>:this.props.children}}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App/></ErrorBoundary></StrictMode>);
